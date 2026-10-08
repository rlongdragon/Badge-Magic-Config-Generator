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

const CONNECT_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 5000;

const STEP_ANIMATION = '完成後在徽章選單選 ANIMATION 播放。';
const STEP_USB = [
  '用 USB 線把徽章接到電腦，不需要進入任何模式。',
  '按下方的上傳按鈕，在跳出的視窗選擇「LED Badge Magic」。',
  STEP_ANIMATION,
];

// Which transports each firmware supports, whether the upload carries a
// timestamp to set the badge clock, and what the user has to do.
export const FIRMWARE_PROFILES = {
  stock: {
    label: '未刷 / 舊版開源韌體',
    hint: '原廠韌體，或開機後沒有選單的舊版開源韌體。',
    transports: {
      ble: {
        timestamp: false,
        steps: [
          '讓徽章進入藍牙模式，畫面會出現藍牙圖示或動畫。舊版開源韌體是短按 KEY1 切換。',
          '按下方的上傳按鈕，在跳出的視窗選擇徽章。',
        ],
      },
    },
    unsupported: { usb: '這個韌體不支援' },
  },
  official: {
    label: '官方最新版',
    hint: 'fossasia/badgemagic-firmware 最新版，開機後有選單。',
    link: 'https://github.com/fossasia/badgemagic-firmware',
    transports: {
      ble: {
        timestamp: true,
        steps: [
          '官方版在 PIN 關閉時會拒絕藍牙上傳，所以先在選單選 SECURITY，把游標移到 ENABLE 並確定。',
          '選 BT-PAIRING，畫面出現 4 位數 PIN 後，按 KEY4（2 鍵版長按 KEY1）略過，畫面會變成藍牙動畫。',
          '按下方的上傳按鈕，在跳出的視窗選擇「LED Badge Magic」。',
          STEP_ANIMATION,
        ],
      },
      usb: { timestamp: false, steps: STEP_USB },
    },
  },
  rlong: {
    label: 'rlong 版',
    hint: '官方最新版加上防頻閃、修正藍牙上傳，USB 上傳也會同步時間。',
    link: 'https://github.com/rlongdragon/badgemagic-firmware/tree/rlong/feature',
    transports: {
      ble: {
        timestamp: true,
        steps: [
          '在徽章選單選 BT-PAIRING，畫面會出現藍牙動畫。',
          '按下方的上傳按鈕，在跳出的視窗選擇「LED Badge Magic」。',
          STEP_ANIMATION,
        ],
      },
      usb: { timestamp: true, steps: STEP_USB },
    },
  },
};

export const TRANSPORTS = {
  ble: { label: '藍牙', isAvailable: () => 'bluetooth' in navigator },
  usb: { label: 'USB', isAvailable: () => 'hid' in navigator },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const abortError = () => new DOMException('Upload cancelled', 'AbortError');

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DOMException(message, 'TimeoutError')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function uploadBle(payload, { onStage, onProgress, signal }) {
  onStage('choose');
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: [BLE_SERVICE] },
      { namePrefix: 'LSLED' },
      { namePrefix: 'VBLAB' },
      { namePrefix: 'LED Badge' },
    ],
    optionalServices: [BLE_SERVICE],
  });
  throwIfAborted(signal);

  // Cancelling drops the link, which makes any pending GATT call reject
  const disconnect = () => device.gatt.connected && device.gatt.disconnect();
  signal?.addEventListener('abort', disconnect);

  try {
    onStage('connect');
    const server = await withTimeout(device.gatt.connect(), CONNECT_TIMEOUT_MS, '連線逾時');
    const service = await withTimeout(server.getPrimaryService(BLE_SERVICE), CONNECT_TIMEOUT_MS, '找不到徽章的上傳服務');
    const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC);
    const packets = splitPackets(payload, BLE_PACKET_SIZE);

    await sleep(BLE_INITIAL_DELAY_MS);
    onStage('send');
    for (let i = 0; i < packets.length; i++) {
      for (let attempt = 1; ; attempt++) {
        throwIfAborted(signal);
        try {
          await withTimeout(characteristic.writeValueWithResponse(packets[i]), WRITE_TIMEOUT_MS, '徽章沒有回應');
          break;
        } catch (err) {
          if (attempt >= BLE_RETRIES || !device.gatt.connected) throw err;
          await sleep(BLE_RETRY_DELAY_MS);
        }
      }
      onProgress(i + 1, packets.length);
      await sleep(BLE_PACKET_DELAY_MS);
    }
  } catch (err) {
    throw signal?.aborted ? abortError() : err;
  } finally {
    signal?.removeEventListener('abort', disconnect);
    // New firmware drops the link by itself once the upload is saved
    disconnect();
  }
}

async function uploadUsb(payload, { onStage, onProgress, signal }) {
  onStage('choose');
  const [device] = await navigator.hid.requestDevice({
    filters: [{ vendorId: USB_VENDOR_ID, productId: USB_PRODUCT_ID }],
  });
  if (!device) throw abortError(); // chooser closed
  throwIfAborted(signal);

  onStage('connect');
  if (!device.opened) await device.open();
  try {
    const reports = splitPackets(payload, HID_REPORT_SIZE);
    onStage('send');
    for (let i = 0; i < reports.length; i++) {
      throwIfAborted(signal);
      await withTimeout(device.sendReport(0, reports[i]), WRITE_TIMEOUT_MS, '徽章沒有回應');
      onProgress(i + 1, reports.length);
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
 * @param handlers   { onStage(stage), onProgress(sent, total), signal }
 */
export async function uploadToBadge(messages, firmware, transport, handlers = {}) {
  const options = FIRMWARE_PROFILES[firmware]?.transports[transport];
  if (!options) {
    throw new Error(`${FIRMWARE_PROFILES[firmware]?.label ?? firmware} 不支援${TRANSPORTS[transport]?.label ?? transport}上傳`);
  }

  const payload = buildLegacyPayload(messages, {
    timestamp: options.timestamp ? new Date() : null,
  });
  const h = { onStage: () => {}, onProgress: () => {}, ...handlers };

  if (transport === 'ble') {
    await uploadBle(payload, h);
  } else {
    await uploadUsb(payload, h);
  }
}
