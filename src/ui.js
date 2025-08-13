import { SVG_PIXEL_SIZE, TARGET_HEIGHT } from './constants.js';

const svgContainer = document.getElementById("svg-container");
const debugCanvas = document.getElementById("font-canvas");
const debugCtx = debugCanvas.getContext("2d");
const outputContainer = document.getElementById("output-container") || createOutputContainer();

function createOutputContainer() {
    let container = document.getElementById("output-container");
    if (!container) {
        container = document.createElement("pre");
        container.id = "output-container";
        const downloadBtn = document.getElementById("download-btn");
        downloadBtn.parentNode.insertBefore(container, downloadBtn);
    }
    return container;
}

export function updateJsonOutput(data) {
    outputContainer.textContent = JSON.stringify(data, null, 2);
}

export function updateMarqueePreview(matrix) {
    if (!matrix || matrix.length === 0) {
        svgContainer.innerHTML = "";
        return;
    }

    const visualWidth = matrix.length;
    const visualHeight = TARGET_HEIGHT;

    const padding = SVG_PIXEL_SIZE * 0.5;
    const svgWidth = visualWidth * SVG_PIXEL_SIZE + padding;
    const svgHeight = visualHeight * SVG_PIXEL_SIZE + padding;
    const offsetX = padding / 2;
    const offsetY = padding / 2;

    let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;
    for (let y = 0; y < visualHeight; y++) {
        for (let x = 0; x < visualWidth; x++) {
            const scaleFactor = 0.45;
            const aspectRatio = 2.4;
            const rectWidth = SVG_PIXEL_SIZE * aspectRatio * scaleFactor;
            const rectHeight = SVG_PIXEL_SIZE * scaleFactor;
            const centerX = offsetX + x * SVG_PIXEL_SIZE + SVG_PIXEL_SIZE / 2;
            const centerY = offsetY + y * SVG_PIXEL_SIZE + SVG_PIXEL_SIZE / 2;
            const rectX = centerX - rectWidth / 2;
            const rectY = centerY - rectHeight / 2;
            const ledOnColor = "#e53935";
            const ledOffColor = "#5f5353ff";
            const color = matrix[x] && matrix[x][y] === 1 ? ledOnColor : ledOffColor;
            svgContent += `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="${color}" transform="rotate(-45 ${centerX} ${centerY})" />`;
        }
    }
    svgContent += `</svg>`;
    svgContainer.innerHTML = svgContent;
}

export function updateTextPreview(matrix) {
    if (!matrix || matrix.length === 0) {
        debugCanvas.width = 0;
        debugCanvas.height = 0;
        return;
    }

    const visualWidth = matrix.length;
    const visualHeight = TARGET_HEIGHT;

    debugCanvas.width = visualWidth * SVG_PIXEL_SIZE;
    debugCanvas.height = visualHeight * SVG_PIXEL_SIZE;
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugCtx.fillStyle = "#000";
    for (let y = 0; y < visualHeight; y++) {
        for (let x = 0; x < visualWidth; x++) {
            if (matrix[x] && matrix[x][y] === 1) {
                debugCtx.fillRect(
                    x * SVG_PIXEL_SIZE,
                    y * SVG_PIXEL_SIZE,
                    SVG_PIXEL_SIZE,
                    SVG_PIXEL_SIZE
                );
            }
        }
    }
}

export function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 3000);
}