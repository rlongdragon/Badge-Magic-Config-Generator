import { FONTS } from './fonts.js';

export function createPage(text = '') {
  return {
    mode: 'text', // 'text' or 'image'
    text,
    fontId: FONTS[0].id,
    direction: 'left',
    speed: 1,
    matrix: [],
    renderSeq: 0, // drops results of renders that finished out of order
  };
}

export const appState = {
  pages: [createPage('俐方体11號')],
  current: 0,
  previewMode: 'marquee', // 'marquee' or 'text'
};
