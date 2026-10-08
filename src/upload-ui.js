import { FIRMWARE_PROFILES, TRANSPORTS, uploadToBadge } from './uploader.js';
import { checkTransport, markPermissionBlocked, listenForChanges } from './browser-support.js';
import { payloadSize } from './badge-protocol.js';
import { MAX_PAYLOAD_BYTES } from './constants.js';

const STORAGE_KEY = 'badge-upload';

const STAGE_TEXT = {
  ble: { choose: '請在跳出的視窗選擇徽章…', connect: '連線中…', send: '傳送中…' },
  usb: { choose: '請在跳出的視窗選擇「LED Badge Magic」…', connect: '開啟裝置中…', send: '傳送中…' },
};

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      firmware: prefs.firmware in FIRMWARE_PROFILES ? prefs.firmware : 'stock',
      transport: prefs.transport in TRANSPORTS ? prefs.transport : 'ble',
    };
  } catch (e) {
    return { firmware: 'stock', transport: 'ble' };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) { /* storage unavailable */ }
}

// Web Bluetooth rejects with NotFoundError both when the chooser is closed
// and when Bluetooth is blocked or missing, so tell them apart by message.
function isCancelled(err) {
  return err?.name === 'AbortError'
    || (err?.name === 'NotFoundError' && /cancel/i.test(err.message));
}

function isPermissionBlocked(err) {
  return /permission|blocked/i.test(err?.message || '')
    || (err?.name === 'SecurityError');
}

function describeError(err, transport) {
  const message = err?.message || String(err);
  if (/adapter/i.test(message)) {
    return '找不到藍牙介面卡，請確認電腦的藍牙已開啟。';
  }
  switch (err?.name) {
    case 'TimeoutError':
      return `${message}。請確認徽章${transport === 'ble' ? '在藍牙模式並靠近電腦' : '已接上電腦'}，再試一次。`;
    case 'NetworkError':
      return '連線中斷。請確認徽章在藍牙模式並靠近電腦，再試一次。';
    case 'NotSupportedError':
    case 'NotFoundError':
      return '找不到徽章的上傳服務，請確認選擇的韌體正確。';
    case 'NotAllowedError':
      return '無法開啟 USB 裝置，可能被其他程式佔用（例如 WSL / usbipd）。';
    default:
      if (/GATT operation failed/i.test(message)) {
        return '徽章拒絕了上傳。請確認選擇的韌體正確，並照上面的步驟讓徽章進入可上傳的狀態。';
      }
      return message;
  }
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** @param getMessages returns the `messages` array of the current JSON */
export function initUploadPanel(getMessages) {
  const tabs = document.getElementById('firmware-tabs');
  const firmwareHint = document.getElementById('firmware-hint');
  const transportOptions = document.getElementById('transport-options');
  const alertBox = document.getElementById('upload-alert');
  const steps = document.getElementById('upload-steps');
  const uploadBtn = document.getElementById('upload-btn');
  const cancelBtn = document.getElementById('upload-cancel');
  const progress = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const status = document.getElementById('upload-status');

  const prefs = loadPrefs();
  let firmware = prefs.firmware;
  let transport = prefs.transport;
  let controller = null; // set while uploading
  let stage = null;
  let blockingProblem = false;
  let tooLarge = false;
  let checkSeq = 0;

  function setStatus(text, kind = '') {
    status.textContent = text;
    status.className = `upload-status${kind ? ` upload-status--${kind}` : ''}`;
  }

  function renderButtons() {
    const busy = controller !== null;
    uploadBtn.textContent = `用${TRANSPORTS[transport].label}上傳`;
    uploadBtn.disabled = busy || blockingProblem || tooLarge;
    uploadBtn.hidden = busy;
    // The browser's device chooser cannot be closed from script
    cancelBtn.hidden = !busy || stage === 'choose';
    tabs.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
    transportOptions.querySelectorAll('input').forEach((i) => {
      i.disabled = busy || i.dataset.unsupported === 'true';
    });
  }

  async function renderAlert() {
    const seq = ++checkSeq;
    const problem = await checkTransport(transport);
    if (seq !== checkSeq) return; // a newer check is running

    blockingProblem = problem?.level === 'error';
    alertBox.hidden = !problem;
    alertBox.replaceChildren();
    if (problem) {
      alertBox.className = `upload-alert upload-alert--${problem.level}`;
      alertBox.append(el('strong', { textContent: problem.title }));
      problem.body.forEach((line) => alertBox.append(el('p', { textContent: line })));
      if (problem.code) alertBox.append(el('code', { textContent: problem.code }));
    }
    renderButtons();
  }

  function renderSteps() {
    const options = FIRMWARE_PROFILES[firmware].transports[transport];
    steps.replaceChildren(...options.steps.map((text) => el('li', { textContent: text })));
  }

  function renderTransports() {
    const profile = FIRMWARE_PROFILES[firmware];
    if (!profile.transports[transport]) transport = Object.keys(profile.transports)[0];

    transportOptions.replaceChildren();
    Object.entries(TRANSPORTS).forEach(([key, info]) => {
      const options = profile.transports[key];
      const meta = options
        ? (options.timestamp ? '會同步時間' : '不同步時間')
        : profile.unsupported?.[key] ?? '不支援';

      const input = el('input', {
        type: 'radio',
        name: 'transport',
        id: `transport-${key}`,
        value: key,
        checked: key === transport,
      });
      input.dataset.unsupported = String(!options);
      input.addEventListener('change', () => {
        transport = key;
        savePrefs({ firmware, transport });
        setStatus('');
        renderSteps();
        renderAlert();
      });

      const label = el('label', { htmlFor: input.id, className: 'transport-option' }, [
        el('span', { className: 'transport-option__name', textContent: info.label }),
        el('span', { className: 'transport-option__meta', textContent: meta }),
      ]);
      transportOptions.append(input, label);
    });

    renderSteps();
    renderAlert();
  }

  function renderFirmware() {
    tabs.querySelectorAll('button').forEach((btn) => {
      const selected = btn.dataset.firmware === firmware;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', String(selected));
    });

    const profile = FIRMWARE_PROFILES[firmware];
    firmwareHint.replaceChildren(profile.hint);
    if (profile.link) {
      firmwareHint.append(' ', el('a', {
        href: profile.link, target: '_blank', rel: 'noopener', textContent: '韌體原始碼',
      }));
    }
    renderTransports();
  }

  Object.entries(FIRMWARE_PROFILES).forEach(([key, profile]) => {
    const btn = el('button', { type: 'button', textContent: profile.label });
    btn.dataset.firmware = key;
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      firmware = key;
      savePrefs({ firmware, transport });
      setStatus('');
      renderFirmware();
    });
    tabs.append(btn);
  });

  // Called whenever the content changes
  function refresh() {
    const messages = getMessages();
    const wasTooLarge = tooLarge;
    tooLarge = Boolean(messages) && payloadSize(messages) > MAX_PAYLOAD_BYTES;
    if (tooLarge) {
      setStatus('內容超過徽章容量，無法上傳。請看上方的「徽章容量」。', 'error');
    } else if (wasTooLarge) {
      setStatus('');
    }
    if (!controller) renderButtons();
  }

  uploadBtn.addEventListener('click', async () => {
    const messages = getMessages();
    if (!messages || messages.every((m) => m.text.length === 0)) {
      setStatus('沒有可上傳的內容，請先輸入文字或選擇圖片。', 'error');
      return;
    }
    // Last line of defence: an oversized upload can crash the badge
    if (payloadSize(messages) > MAX_PAYLOAD_BYTES) {
      refresh();
      return;
    }

    const options = FIRMWARE_PROFILES[firmware].transports[transport];
    controller = new AbortController();
    renderButtons();
    progress.hidden = true;
    progressBar.style.width = '0%';

    try {
      await uploadToBadge(messages, firmware, transport, {
        signal: controller.signal,
        onStage: (s) => {
          stage = s;
          setStatus(STAGE_TEXT[transport][s]);
          progress.hidden = s !== 'send';
          renderButtons();
        },
        onProgress: (sent, total) => {
          setStatus(`傳送中… ${sent} / ${total}`);
          progressBar.style.width = `${Math.round((sent / total) * 100)}%`;
        },
      });
      const parts = ['上傳完成！'];
      if (firmware !== 'stock') parts.push('在徽章選單選 ANIMATION 播放。');
      if (options.timestamp) parts.push('徽章的時間也已同步。');
      setStatus(parts.join(''), 'success');
    } catch (err) {
      if (isCancelled(err)) {
        setStatus('已取消。');
      } else if (isPermissionBlocked(err)) {
        markPermissionBlocked(transport);
        setStatus('上傳失敗：瀏覽器封鎖了權限，請看上方的說明。', 'error');
        await renderAlert();
      } else {
        setStatus(`上傳失敗：${describeError(err, transport)}`, 'error');
      }
    } finally {
      controller = null;
      stage = null;
      progress.hidden = true;
      renderButtons();
    }
  });

  cancelBtn.addEventListener('click', () => controller?.abort());

  listenForChanges(() => renderAlert());
  renderFirmware();
  refresh();
  return { refresh };
}
