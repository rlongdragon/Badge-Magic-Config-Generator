// Legacy "wang" upload format, understood by the stock firmware, the open
// firmware and the Badge Magic app. Layout follows the app's
// DataToByteArrayConverter.

export const BLE_PACKET_SIZE = 16;
export const HID_REPORT_SIZE = 64;

const HEADER_SIZE = 64;
const MAX_MESSAGES = 8;
const TIMESTAMP_OFFSET = 38;

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

// Year is sent as the low byte of the full year (2026 -> 0xEA), which is
// what the official firmware decodes. Unlike the app, month is 1-12.
function timestampBytes(date) {
  return [
    date.getFullYear() & 0xff,
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ];
}

/**
 * @param messages  [{ text: ["<22 hex chars>", ...], flash, marquee, speed: "0x00".."0x70", mode: "0x00" }]
 * @param timestamp Date to sync the badge clock, or null to leave it all zero
 * @returns Uint8Array, padded to a multiple of BLE_PACKET_SIZE
 */
export function buildLegacyPayload(messages, { timestamp = null } = {}) {
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new Error(`需要 1 到 ${MAX_MESSAGES} 則訊息`);
  }

  const header = new Array(HEADER_SIZE).fill(0);
  header.splice(0, 4, 0x77, 0x61, 0x6e, 0x67); // "wang"

  const body = [];
  messages.forEach((msg, i) => {
    if (msg.flash) header[6] |= 1 << i;
    if (msg.marquee) header[7] |= 1 << i;
    header[8 + i] = parseInt(msg.speed, 16) | parseInt(msg.mode, 16);
    header[16 + 2 * i] = (msg.text.length >> 8) & 0xff;
    header[17 + 2 * i] = msg.text.length & 0xff;
    msg.text.forEach((chunk) => body.push(...hexToBytes(chunk)));
  });

  if (timestamp) {
    header.splice(TIMESTAMP_OFFSET, 6, ...timestampBytes(timestamp));
  }

  // Same padding as the app: always at least one zero byte
  const length = HEADER_SIZE + body.length;
  const padded = (Math.floor(length / BLE_PACKET_SIZE) + 1) * BLE_PACKET_SIZE;

  const payload = new Uint8Array(padded);
  payload.set(header, 0);
  payload.set(body, HEADER_SIZE);
  return payload;
}

/** Split into fixed-size packets; the last one is zero-padded. */
export function splitPackets(payload, size) {
  const packets = [];
  for (let i = 0; i < payload.length; i += size) {
    const packet = new Uint8Array(size);
    packet.set(payload.subarray(i, i + size));
    packets.push(packet);
  }
  return packets;
}
