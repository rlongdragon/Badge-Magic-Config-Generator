import { TARGET_HEIGHT } from './constants.js';
import { ensureFont, REFERENCE_GLYPH } from './fonts.js';

const renderCanvas = document.createElement("canvas");
const renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });

// Draw `text` with its baseline at a fixed row and return the ink.
function render(text, font) {
    renderCtx.font = `${font.size}px "${font.family}"`;
    const width = Math.ceil(renderCtx.measureText(text).width) + font.size * 2;
    const height = font.size * 3;
    const baseline = font.size * 2;

    // Resizing clears the canvas and resets the context state
    renderCanvas.width = width;
    renderCanvas.height = height;
    renderCtx.font = `${font.size}px "${font.family}"`;
    renderCtx.textBaseline = "alphabetic";
    renderCtx.fillStyle = "#000";
    renderCtx.fillText(text, font.size, baseline);

    const data = renderCtx.getImageData(0, 0, width, height).data;
    const isInk = (x, y) => data[(y * width + x) * 4 + 3] > 128;

    let minX = width, maxX = -1, minY = height;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isInk(x, y)) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
            }
        }
    }
    return { isInk, minX, maxX, minY, height };
}

/**
 * Render `text` in `font` to a column-major matrix of TARGET_HEIGHT rows.
 * The line is placed so CJK glyphs start at font.cjkTop; anything that
 * falls outside the 11 rows (some accents and descenders) is clipped.
 */
export async function analyzeText(text, font) {
    if (!text) {
        return [];
    }

    await ensureFont(font, text);

    // Same baseline for every render, so the reference glyph tells us
    // which canvas row is display row 0
    const reference = render(REFERENCE_GLYPH, font);
    const top = reference.minY - font.cjkTop;

    const ink = render(text, font);
    if (ink.maxX === -1) {
        return [];
    }

    const matrix = [];
    for (let x = ink.minX; x <= ink.maxX; x++) {
        const column = [];
        for (let row = 0; row < TARGET_HEIGHT; row++) {
            const y = top + row;
            column.push(y >= 0 && y < ink.height && ink.isInk(x, y) ? 1 : 0);
        }
        matrix.push(column);
    }
    return matrix;
}
