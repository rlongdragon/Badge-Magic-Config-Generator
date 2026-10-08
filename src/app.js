import { appState, createPage } from './state.js';
import { MAX_MESSAGES, MAX_PAYLOAD_BYTES } from './constants.js';
import { FONTS, getFont } from './fonts.js';
import { analyzeText } from './text-processor.js';
import { handleImageFile } from './image-processor.js';
import { convertPagesToJson } from './matrix-converter.js';
import { payloadSize } from './badge-protocol.js';
import { updateJsonOutput, updateMarqueePreview, updateTextPreview, showError } from './ui.js';
import { initUploadPanel } from './upload-ui.js';

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const pageTabs = document.getElementById("page-tabs");
    const pageAdd = document.getElementById("page-add");
    const pageTitle = document.getElementById("page-title");
    const pageDelete = document.getElementById("page-delete");
    const textInput = document.getElementById("text-input");
    const fontSelect = document.getElementById("font-select");
    const fontStatus = document.getElementById("font-status");
    const imageDropZone = document.getElementById("image-drop-zone");
    const imageInput = document.getElementById("image-input");
    const imagePreviewCanvas = document.getElementById("image-preview-canvas");
    const modeToggles = document.querySelectorAll('input[name="mode"]');
    const textModeContent = document.getElementById("text-mode-content");
    const imageModeContent = document.getElementById("image-mode-content");
    const previewToggles = document.querySelectorAll('input[name="preview-toggle"]');
    const marqueePreview = document.getElementById("marquee-preview");
    const textPreview = document.getElementById("text-preview");
    const directionToggles = document.querySelectorAll('input[name="direction"]');
    const speedSlider = document.getElementById("speed-slider");
    const speedValue = document.getElementById("speed-value");
    const downloadBtn = document.getElementById("download-btn");
    const previewControls = document.querySelector(".preview-controls");
    const capacity = document.getElementById("capacity");
    const capacityText = document.getElementById("capacity-text");
    const capacityBar = document.getElementById("capacity-bar");
    const capacityNote = document.getElementById("capacity-note");

    // Latest exported data, shared by the JSON download and direct upload
    let latestData = null;
    let uploadPanel = null;

    const currentPage = () => appState.pages[appState.current];

    // --- Output ---
    function updateCapacity(data) {
        const used = payloadSize(data.messages);
        const ratio = used / MAX_PAYLOAD_BYTES;
        const over = used > MAX_PAYLOAD_BYTES;

        capacityText.textContent = `${used.toLocaleString()} / ${MAX_PAYLOAD_BYTES.toLocaleString()} bytes`;
        capacityBar.style.width = `${Math.min(ratio, 1) * 100}%`;
        capacity.classList.toggle("capacity--warn", ratio > 0.8 && !over);
        capacity.classList.toggle("capacity--over", over);
        capacityNote.textContent = over
            ? "內容太長了，徽章的記憶體放不下，上傳可能讓徽章當機。請縮短文字或刪掉幾則訊息。"
            : "";
    }

    function updateOutput() {
        latestData = convertPagesToJson(appState.pages);
        updateJsonOutput(latestData);
        updateCapacity(latestData);
        uploadPanel?.refresh();
    }

    function updatePreview() {
        const matrix = currentPage().matrix;
        if (appState.previewMode === 'marquee') {
            updateMarqueePreview(matrix);
        } else {
            updateTextPreview(matrix);
        }
    }

    // --- Page tabs ---
    function pageLabel(page, index) {
        const name = `訊息 ${index + 1}`;
        if (page.mode === 'image') return `${name}（圖片）`;
        return page.text ? `${name}：${page.text.slice(0, 6)}${page.text.length > 6 ? '…' : ''}` : name;
    }

    function renderPageTabs() {
        pageTabs.replaceChildren(...appState.pages.map((page, index) => {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = "page-tabs__tab";
            tab.textContent = pageLabel(page, index);
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-selected", String(index === appState.current));
            tab.classList.toggle("active", index === appState.current);
            if (page.matrix.length === 0) tab.classList.add("empty");
            tab.addEventListener("click", () => selectPage(index));
            return tab;
        }));
        pageAdd.disabled = appState.pages.length >= MAX_MESSAGES;
        pageAdd.title = pageAdd.disabled ? `最多 ${MAX_MESSAGES} 則訊息` : "新增一則訊息";
        pageDelete.disabled = appState.pages.length <= 1;
        pageTitle.textContent = `訊息 ${appState.current + 1} / ${appState.pages.length}`;
    }

    // Show the current page's settings in the editor
    function loadPageIntoEditor() {
        const page = currentPage();
        modeToggles.forEach((t) => { t.checked = t.value === page.mode; });
        textModeContent.style.display = page.mode === 'text' ? 'block' : 'none';
        imageModeContent.style.display = page.mode === 'image' ? 'block' : 'none';
        previewControls.style.display = page.mode === 'text' ? 'flex' : 'none';
        textInput.value = page.text;
        fontSelect.value = page.fontId;
        directionToggles.forEach((t) => { t.checked = t.value === page.direction; });
        speedSlider.value = page.speed;
        speedValue.textContent = page.speed;
        imageInput.value = '';
        imagePreviewCanvas.style.display = 'none';
        fontStatus.textContent = '';
        renderPageTabs();
        updatePreview();
    }

    function selectPage(index) {
        appState.current = index;
        loadPageIntoEditor();
    }

    pageAdd.addEventListener("click", () => {
        if (appState.pages.length >= MAX_MESSAGES) return;
        const page = createPage();
        page.fontId = currentPage().fontId; // keep the font the user picked
        appState.pages.push(page);
        selectPage(appState.pages.length - 1);
        updateOutput();
        textInput.focus();
    });

    pageDelete.addEventListener("click", () => {
        if (appState.pages.length <= 1) return;
        appState.pages.splice(appState.current, 1);
        appState.current = Math.min(appState.current, appState.pages.length - 1);
        loadPageIntoEditor();
        updateOutput();
    });

    // --- Text rendering ---
    async function renderText(page) {
        const seq = ++page.renderSeq;
        const font = getFont(page.fontId);
        if (page === currentPage()) fontStatus.textContent = font.css ? '載入字體中…' : '';

        let matrix;
        try {
            matrix = await analyzeText(page.text, font);
        } catch (err) {
            if (seq === page.renderSeq && page === currentPage()) {
                fontStatus.textContent = '';
                showError(err.message || '字體載入失敗');
            }
            return;
        }
        if (seq !== page.renderSeq) return; // a newer render is on its way

        page.matrix = matrix;
        if (page === currentPage()) {
            fontStatus.textContent = '';
            updatePreview();
        }
        renderPageTabs();
        updateOutput();
    }

    FONTS.forEach((font) => {
        const option = document.createElement("option");
        option.value = font.id;
        option.textContent = font.label;
        fontSelect.append(option);
    });

    fontSelect.addEventListener("change", (e) => {
        const page = currentPage();
        page.fontId = e.target.value;
        renderText(page);
    });

    textInput.addEventListener("input", (e) => {
        const page = currentPage();
        page.text = e.target.value;
        renderText(page);
    });

    // --- Per-page settings ---
    directionToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            currentPage().direction = e.target.value;
            updateOutput();
        });
    });

    speedSlider.addEventListener('input', (e) => {
        currentPage().speed = parseInt(e.target.value, 10);
        speedValue.textContent = currentPage().speed;
        updateOutput();
    });

    modeToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const page = currentPage();
            page.mode = e.target.value;
            page.matrix = [];
            page.text = '';
            page.renderSeq++; // ignore a text render still in flight
            loadPageIntoEditor();
            updateOutput();
        });
    });

    previewToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            appState.previewMode = e.target.value;
            marqueePreview.style.display = appState.previewMode === 'marquee' ? 'block' : 'none';
            textPreview.style.display = appState.previewMode === 'marquee' ? 'none' : 'block';
            updatePreview();
        });
    });

    // --- Image Handling ---
    function loadImage(files) {
        const page = currentPage();
        handleImageFile(files, (matrix) => {
            page.matrix = matrix;
            if (page === currentPage()) updateMarqueePreview(matrix); // Always show marquee for image
            renderPageTabs();
            updateOutput();
        }, showError);
    }

    imageDropZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            loadImage(e.target.files);
        }
    });
    imageDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageDropZone.classList.add('dragover');
    });
    imageDropZone.addEventListener('dragleave', () => imageDropZone.classList.remove('dragover'));
    imageDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageDropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            loadImage(e.dataTransfer.files);
        }
    });
    window.addEventListener('paste', (e) => {
        if (currentPage().mode !== 'image' || !e.clipboardData.files || e.clipboardData.files.length === 0) {
            return;
        }

        const imageFiles = Array.from(e.clipboardData.files).filter(file => file.type.startsWith('image/'));

        if (imageFiles.length > 0) {
            loadImage(imageFiles);
        }
    });

    // --- Download ---
    downloadBtn.addEventListener("click", () => {
        if (!latestData) {
            showError("沒有可下載的資料！");
            return;
        }
        const dataStr = JSON.stringify(latestData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const fileName = `badge_${day}${month}-${hours}_${minutes}.json`;
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // --- Initial Load ---
    uploadPanel = initUploadPanel(() => latestData?.messages);
    loadPageIntoEditor();
    updateOutput();
    document.fonts.ready.then(() => renderText(currentPage()));
});
