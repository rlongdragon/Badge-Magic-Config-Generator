import { FIRMWARE_PROFILES, TRANSPORTS, uploadToBadge } from './uploader.js';
import { showError } from './ui.js';

const STORAGE_KEY = 'badge-upload-firmware';

function loadFirmware() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved in FIRMWARE_PROFILES) return saved;
  } catch (e) { /* storage unavailable */ }
  return 'stock';
}

function saveFirmware(firmware) {
  try {
    localStorage.setItem(STORAGE_KEY, firmware);
  } catch (e) { /* storage unavailable */ }
}

// Web Bluetooth rejects with NotFoundError both when the chooser is closed
// and when Bluetooth is blocked or missing, so tell them apart by message.
function isCancelled(err) {
  return err?.name === 'AbortError'
    || (err?.name === 'NotFoundError' && /cancel/i.test(err.message));
}

function describeError(err) {
  const message = err?.message || String(err);
  if (/permission/i.test(message)) {
    return '瀏覽器封鎖了這個網站的藍牙權限。請在網址列左邊的網站設定把「藍牙」改成允許；Brave 還需要到 brave://flags 開啟 Web Bluetooth API。';
  }
  if (/adapter/i.test(message)) {
    return '找不到藍牙介面卡，請確認電腦的藍牙已開啟。';
  }
  switch (err?.name) {
    case 'SecurityError':
      return '瀏覽器拒絕存取裝置，請確認網頁是用 HTTPS 開啟。';
    case 'NetworkError':
      return '連線中斷，請確認徽章在藍牙模式並靠近電腦後再試一次。';
    case 'NotAllowedError':
      return '無法開啟 USB 裝置，可能被其他程式佔用。';
    default:
      return message;
  }
}

/** @param getMessages returns the `messages` array of the current JSON */
export function initUploadPanel(getMessages) {
  const tabs = document.getElementById('firmware-tabs');
  const firmwareNote = document.getElementById('firmware-note');
  const pills = document.getElementById('transport-pills');
  const transportNote = document.getElementById('transport-note');
  const uploadBtn = document.getElementById('upload-btn');
  const progress = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const status = document.getElementById('upload-status');

  let firmware = loadFirmware();
  let transport = 'ble';
  let busy = false;

  function renderTransportNote() {
    const options = FIRMWARE_PROFILES[firmware].transports[transport];
    const info = TRANSPORTS[transport];
    const supported = info.isSupported();

    transportNote.textContent = supported
      ? (options.timestamp ? '上傳時會同步徽章的時間。' : '不會同步時間。')
      : info.unsupportedReason;
    transportNote.classList.toggle('upload-note--warn', !supported);
    uploadBtn.disabled = busy || !supported;
  }

  function renderTransports() {
    const available = Object.keys(FIRMWARE_PROFILES[firmware].transports);
    if (!available.includes(transport)) transport = available[0];

    pills.innerHTML = '';
    available.forEach((key) => {
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'transport';
      input.id = `transport-${key}`;
      input.value = key;
      input.checked = key === transport;
      input.addEventListener('change', () => {
        transport = key;
        renderTransportNote();
      });

      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = TRANSPORTS[key].label;
      pills.append(input, label);
    });
    renderTransportNote();
  }

  function renderFirmware() {
    tabs.querySelectorAll('button').forEach((btn) => {
      const selected = btn.dataset.firmware === firmware;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', selected);
    });

    const profile = FIRMWARE_PROFILES[firmware];
    firmwareNote.textContent = profile.note + ' ';
    if (profile.link) {
      const a = document.createElement('a');
      a.href = profile.link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = '韌體原始碼';
      firmwareNote.append(a);
    }
    renderTransports();
  }

  Object.entries(FIRMWARE_PROFILES).forEach(([key, profile]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.firmware = key;
    btn.textContent = profile.label;
    btn.addEventListener('click', () => {
      if (busy) return;
      firmware = key;
      saveFirmware(key);
      status.textContent = '';
      renderFirmware();
    });
    tabs.append(btn);
  });

  uploadBtn.addEventListener('click', async () => {
    const messages = getMessages();
    if (!messages || messages.every((m) => m.text.length === 0)) {
      showError('沒有可上傳的內容！');
      return;
    }

    busy = true;
    uploadBtn.disabled = true;
    progress.hidden = false;
    progressBar.style.width = '0%';
    status.textContent = transport === 'ble' ? '請在跳出的視窗選擇徽章…' : '請在跳出的視窗選擇 USB 裝置…';

    try {
      await uploadToBadge(messages, firmware, transport, (ratio) => {
        status.textContent = '上傳中…';
        progressBar.style.width = `${Math.round(ratio * 100)}%`;
      });
      status.textContent = firmware === 'stock'
        ? '上傳完成！'
        : '上傳完成！在徽章選單選 ANIMATION 就能看到。';
    } catch (err) {
      if (isCancelled(err)) {
        status.textContent = '已取消。';
      } else {
        status.textContent = '';
        showError(`上傳失敗：${describeError(err)}`);
      }
    } finally {
      busy = false;
      progress.hidden = true;
      renderTransportNote();
    }
  });

  renderFirmware();
}
