export const TARGET_HEIGHT = 11;
export const CHUNK_WIDTH = 8;
export const SVG_PIXEL_SIZE = 10;

// The legacy upload format has 8 message slots
export const MAX_MESSAGES = 8;

// Largest upload (header + bitmap) that is safe on the open firmware.
// Its malloc has no upper bound, so an oversized upload overruns the stack
// and crashes the badge, possibly on every boot. About 8.9KB of RAM is
// shared by heap and stack, and while receiving, the badge holds the old
// messages (16 bytes per 8 columns) plus the new upload (11 bytes per 8
// columns). 2048 bytes keeps a safe margin.
export const MAX_PAYLOAD_BYTES = 2048;
