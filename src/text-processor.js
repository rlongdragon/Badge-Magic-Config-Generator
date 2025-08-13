import { FONT_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

const renderCanvas = document.createElement("canvas");
const renderCtx = renderCanvas.getContext("2d");

export function analyzeText(text) {
    if (!text) {
        return [];
    }

    renderCanvas.width = CANVAS_WIDTH;
    renderCanvas.height = CANVAS_HEIGHT;

    renderCtx.font = `${FONT_SIZE}px "Cubic 11"`;
    renderCtx.textBaseline = "top";
    renderCtx.fillStyle = "#000";
    renderCtx.imageSmoothingEnabled = false;
    renderCtx.fillText(text, 0, 0);

    const imageData = renderCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;

    let minX = CANVAS_WIDTH,
      minY = CANVAS_HEIGHT,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const alpha = data[(y * CANVAS_WIDTH + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) {
      return [];
    }

    const visualWidth = maxX - minX + 1;
    const visualHeight = maxY - minY + 1;

    const matrix = [];
    for (let x = 0; x < visualWidth; x++) {
      const newRow = [];
      for (let y = 0; y < visualHeight; y++) {
        const canvasX = minX + x;
        const canvasY = minY + y;
        const alpha = data[(canvasY * CANVAS_WIDTH + canvasX) * 4 + 3];
        newRow.push(alpha > 128 ? 1 : 0);
      }
      matrix.push(newRow);
    }
    
    return matrix;
}