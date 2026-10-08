import { buildLegacyPayload, splitPackets, BLE_PACKET_SIZE, HID_REPORT_SIZE } from './badge-protocol.js';

const BLE_SERVICE = 0xfee0;
const BLE_CHARACTERISTIC = 0xfee1;
const USB_VENDOR_ID = 0x0416;
const USB_PRODUCT_ID = 0x5020;

// Pacing taken from the Badge Magic app (write_state.dart)
const BLE_INITIAL_DELAY_MS = 300;
const BLE_PACKET_DELAY_MS = 120;
const BLE_RETRY_DELAY_MS = 200;
const BLE_RETRIES = 3;
const HID_REPORT_DELAY_MS = 20;

// Which transports each firmware supports, and whether the upload should
// carry a timestamp to set the badge clock.
export const FIRMWARE_PROFILES = {
  stock: {
    label: '未刷 / 舊版開源韌體',
    note: '原廠韌體，或開機後沒有選單的舊版開源韌體。只能用藍牙上傳，不會同步時間。',
    transports: { ble: { timestamp: false } },
  },
  official: {
    label: '官方最新版',
    note: 'fossasia/badgemagic-firmware 最新版。上傳前先在徽章選單選 BT-PAIRING，上傳後選 ANIMATION 播放。',
    link: 'https://github.com/fossasia/badgemagic-firmware',
    transports: { ble: { timestamp: true }, usb: { timestamp: false } },
  },
  rlong: {
    label: 'rlong 版',
    note: '在官方最新版上加了防頻閃，USB 上傳也會同步時間。操作方式同官方最新版。',
    link: 'https://github.com/rlongdragon/badgemagic-firmware/tree/rlong/feature',
    transports: { ble: { timestamp: true }, usb: { timestamp: true } },
  },
};

export const TRANSPORTS = {
  ble: {
    label: '藍牙',
    isSupported: () => 'bluetooth' in navigator,
    unsupportedReason: '這個瀏覽器不支援 Web Bluetooth，請改用桌機或 Android 的 Chrome / Edge。',
  },
  usb: {
    label: 'USB',
    isSupported: () => 'hid' in navigator,
    unsupportedReason: '這個瀏覽器不支援 WebHID，請改用桌機的 Chrome / Edge。',
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadBle(payload, onProgress) {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: [BLE_SERVICE] },
      { namePrefix: 'LSLED' },
      { namePrefix: 'VBLAB' },
      { namePrefix: 'LED Badge' },
    ],
    optionalServices: [BLE_SERVICE],
  });

  const server = await device.gatt.connect();
  try {
    const service = await server.getPrimaryService(BLE_SERVICE);
    const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC);
    const packets = splitPackets(payload, BLE_PACKET_SIZE);

    await sleep(BLE_INITIAL_DELAY_MS);
    for (let i = 0; i < packets.length; i++) {
      for (let attempt = 1; ; attempt++) {
        try {
          await characteristic.writeValueWithResponse(packets[i]);
          break;
        } catch (err) {
          if (attempt >= BLE_RETRIES || !device.gatt.connected) throw err;
          await sleep(BLE_RETRY_DELAY_MS);
        }
      }
      onProgress((i + 1) / packets.length);
      await sleep(BLE_PACKET_DELAY_MS);
    }
  } finally {
    // New firmware drops the link by itself once the upload is saved
    if (device.gatt.connected) device.gatt.disconnect();
  }
}

async function uploadUsb(payload, onProgress) {
  const [device] = await navigator.hid.requestDevice({
    filters: [{ vendorId: USB_VENDOR_ID, productId: USB_PRODUCT_ID }],
  });
  if (!device) {
    throw new DOMException('沒有選擇裝置', 'NotFoundError');
  }

  if (!device.opened) await device.open();
  try {
    const reports = splitPackets(payload, HID_REPORT_SIZE);
    for (let i = 0; i < reports.length; i++) {
      await device.sendReport(0, reports[i]);
      onProgress((i + 1) / reports.length);
      await sleep(HID_REPORT_DELAY_MS);
    }
  } finally {
    await device.close();
  }
}

/**
 * @param messages   the `messages` array of the exported JSON
 * @param firmware   key of FIRMWARE_PROFILES
 * @param transport  "ble" or "usb"
 */
export async function uploadToBadge(messages, firmware, transport, onProgress = () => {}) {
  const options = FIRMWARE_PROFILES[firmware]?.transports[transport];
  if (!options) {
    throw new Error(`${FIRMWARE_PROFILES[firmware]?.label ?? firmware} 不支援${TRANSPORTS[transport]?.label ?? transport}上傳`);
  }

  const payload = buildLegacyPayload(messages, {
    timestamp: options.timestamp ? new Date() : null,
  });

  if (transport === 'ble') {
    await uploadBle(payload, onProgress);
  } else {
    await uploadUsb(payload, onProgress);
  }
}
