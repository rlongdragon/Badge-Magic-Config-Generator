import { appState } from './state.js';
import { analyzeText } from './text-processor.js';
import { handleImageFile } from './image-processor.js';
import { convertMatrixToHexDisplay } from './matrix-converter.js';
import { updateJsonOutput, updateMarqueePreview, updateTextPreview, showError } from './ui.js';

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const textInput = document.getElementById("text-input");
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

    // --- Main Logic ---
    function processAndRender() {
        let matrix = [];
        if (appState.mode === 'text') {
            matrix = analyzeText(appState.text);
        } else {
            // Image processing is handled by its own event listeners
            return;
        }
        appState.matrix = matrix;

        // Update Previews
        if (appState.previewMode === 'marquee') {
            updateMarqueePreview(matrix);
        } else {
            updateTextPreview(matrix);
        }

        // Update JSON Output
        const hexData = convertMatrixToHexDisplay(appState.matrix, appState.direction, appState.speed);
        updateJsonOutput(hexData);
    }

    // --- Event Listeners ---
    textInput.addEventListener("input", (e) => {
        appState.text = e.target.value;
        processAndRender();
    });

    directionToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            appState.direction = e.target.value;
            processAndRender();
        });
    });

    speedSlider.addEventListener('input', (e) => {
        appState.speed = parseInt(e.target.value, 10);
        speedValue.textContent = appState.speed;
        processAndRender();
    });

    modeToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            appState.mode = e.target.value;
            if (appState.mode === 'text') {
                textModeContent.style.display = 'block';
                imageModeContent.style.display = 'none';
                previewControls.style.display = 'flex';
                imageInput.value = '';
                imagePreviewCanvas.style.display = 'none';
                processAndRender();
            } else {
                textModeContent.style.display = 'none';
                imageModeContent.style.display = 'block';
                previewControls.style.display = 'none';
                textInput.value = '';
                appState.text = '';
                processAndRender();
            }
        });
    });

    previewToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            appState.previewMode = e.target.value;
            if (appState.previewMode === 'marquee') {
                marqueePreview.style.display = 'block';
                textPreview.style.display = 'none';
            } else {
                marqueePreview.style.display = 'none';
                textPreview.style.display = 'block';
            }
            processAndRender();
        });
    });
    
    // --- Image Handling ---
    const onMatrixProcessed = (matrix) => {
        appState.matrix = matrix;
        updateMarqueePreview(matrix); // Always show marquee for image
        const hexData = convertMatrixToHexDisplay(matrix, appState.direction, appState.speed);
        updateJsonOutput(hexData);
    };

    imageDropZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleImageFile(e.target.files, onMatrixProcessed);
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
            handleImageFile(e.dataTransfer.files, onMatrixProcessed);
        }
    });
    window.addEventListener('paste', (e) => {
        if (appState.mode === 'image' && e.clipboardData.files && e.clipboardData.files.length > 0) {
             if (e.clipboardData.files.type.startsWith('image/')) {
                handleImageFile(e.clipboardData.files, onMatrixProcessed);
             }
        }
    });

    // --- Download ---
    downloadBtn.addEventListener("click", () => {
        const outputContainer = document.getElementById("output-container");
        if (!outputContainer || !outputContainer.textContent) {
            showError("沒有可下載的資料！");
            return;
        }
        const dataStr = outputContainer.textContent;
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
    document.fonts.ready.then(() => {
        processAndRender();
    });
});