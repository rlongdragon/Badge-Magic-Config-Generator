// Pixel fonts for text mode.
// `size` is the font's native pixel size, where glyphs render without
// anti-aliasing. `cjkTop` is the display row the top of a CJK glyph lands
// on, chosen so the line sits vertically centred on the 11-row display.
// Both were measured by rendering each font at every size from 5 to 24px.
export const FONTS = [
  { id: 'cubic11', label: '俐方體 11 號', family: 'Cubic 11', size: 12, cjkTop: 0 },
  {
    id: 'fusion10', label: 'Fusion Pixel 10px', family: 'FusionPixelFont10pxMono',
    css: 'https://font.emtech.cc/css/FusionPixelFont10pxMono', size: 10, cjkTop: 1,
  },
  {
    id: 'boutique9', label: 'Boutique Bitmap 9×9', family: 'BoutiqueBitmap9x9',
    css: 'https://font.emtech.cc/css/BoutiqueBitmap9x9', size: 10, cjkTop: 1,
  },
  {
    id: 'boutique7', label: 'Boutique Bitmap 7×7', family: 'BoutiqueBitmap7x7',
    css: 'https://font.emtech.cc/css/BoutiqueBitmap7x7', size: 8, cjkTop: 2,
  },
  {
    id: 'chill7', label: 'Chill Bitmap 7px', family: 'ChillBitmap7px',
    css: 'https://font.emtech.cc/css/ChillBitmap7px', size: 8, cjkTop: 2,
  },
];

// Glyph used to find where a font places CJK characters vertically
export const REFERENCE_GLYPH = '國';

export function getFont(id) {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

const stylesheets = new Map();

function loadStylesheet(url) {
  if (!stylesheets.has(url)) {
    stylesheets.set(url, new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = resolve;
      link.onerror = () => {
        stylesheets.delete(url);
        link.remove();
        reject(new Error('無法下載字型，請檢查網路連線'));
      };
      document.head.append(link);
    }));
  }
  return stylesheets.get(url);
}

/**
 * Make sure every glyph of `text` is available before drawing it on a
 * canvas. emfont splits fonts by unicode-range, and the browser only
 * downloads the pieces that document.fonts.load() asks for.
 */
export async function ensureFont(font, text) {
  if (font.css) await loadStylesheet(font.css);
  await document.fonts.load(`${font.size}px "${font.family}"`, text + REFERENCE_GLYPH);
}
