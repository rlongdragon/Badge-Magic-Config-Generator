// Detects why Bluetooth / USB upload may not work in this browser, so the
// page can tell the user before they press the button.

const BRAVE_BLUETOOTH_FLAG = 'brave://flags/#brave-web-bluetooth-api';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function isBrave() {
  try {
    return Boolean(await navigator.brave?.isBrave());
  } catch (e) {
    return false;
  }
}

// Set when an upload fails because the browser blocked the permission;
// the browser API offers no reliable way to query this up front.
const blocked = { ble: false, usb: false };

export function markPermissionBlocked(transport) {
  blocked[transport] = true;
}

/**
 * @returns null when the transport looks usable, otherwise
 *   { level: 'error' | 'warn', title, body: [lines], code?: string }
 *   'error' means uploading cannot work; 'warn' means it may fail.
 */
export async function checkTransport(transport) {
  if (!window.isSecureContext) {
    return {
      level: 'error',
      title: '需要用 HTTPS 開啟這個網頁',
      body: ['瀏覽器只允許 HTTPS 或 localhost 的網頁使用藍牙與 USB。'],
    };
  }

  return transport === 'ble' ? checkBluetooth() : checkUsb();
}

async function checkBluetooth() {
  const brave = await isBrave();
  const braveLine = '在網址列輸入下面的網址，把「Web Bluetooth API」改成 Enabled，再重新啟動瀏覽器。';

  if (!('bluetooth' in navigator)) {
    if (brave) {
      return { level: 'error', title: 'Brave 預設關閉了藍牙功能', body: [braveLine], code: BRAVE_BLUETOOTH_FLAG };
    }
    if (isIOS()) {
      return {
        level: 'error',
        title: 'iPhone / iPad 不支援網頁藍牙',
        body: ['iOS 上的所有瀏覽器都無法使用網頁藍牙，請改用電腦或 Android 的 Chrome / Edge。'],
      };
    }
    return {
      level: 'error',
      title: '這個瀏覽器不支援藍牙上傳',
      body: ['請改用電腦或 Android 的 Chrome / Edge。'],
    };
  }

  if (blocked.ble) {
    const body = ['點網址列左邊的圖示，進「網站設定」，把「藍牙裝置」改成「詢問」或「允許」，再重新整理頁面。'];
    if (brave) body.push(`Brave 另外要確認 ${BRAVE_BLUETOOTH_FLAG} 已經開啟。`);
    return { level: 'error', title: '瀏覽器封鎖了這個網站的藍牙權限', body };
  }

  let available = true;
  try {
    available = await navigator.bluetooth.getAvailability();
  } catch (e) { /* unknown, assume available */ }

  if (!available) {
    const body = [
      '請確認電腦的藍牙已經開啟。',
      '如果藍牙是開的，可能是網站的藍牙權限被封鎖：點網址列左邊的圖示，進「網站設定」，把「藍牙裝置」改成「詢問」。',
    ];
    if (brave) body.push(`Brave 另外要確認 ${BRAVE_BLUETOOTH_FLAG} 已經開啟。`);
    return { level: 'warn', title: '偵測不到可用的藍牙', body };
  }

  return null;
}

async function checkUsb() {
  if (!('hid' in navigator)) {
    return {
      level: 'error',
      title: '這個瀏覽器不支援 USB 上傳',
      body: ['USB 上傳需要電腦版的 Chrome / Edge。手機請改用藍牙。'],
    };
  }

  if (blocked.usb) {
    return {
      level: 'error',
      title: '瀏覽器封鎖了這個網站的 USB 權限',
      body: ['點網址列左邊的圖示，進「網站設定」，允許「HID 裝置」，再重新整理頁面。'],
    };
  }

  return null;
}

export function listenForChanges(callback) {
  navigator.bluetooth?.addEventListener?.('availabilitychanged', callback);
}
