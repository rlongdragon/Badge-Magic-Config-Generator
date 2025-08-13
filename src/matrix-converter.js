import { TARGET_HEIGHT, CHUNK_WIDTH } from './constants.js';

export function convertMatrixToHexDisplay(matrix, direction, speed) {
  if (!matrix || matrix.length === 0) {
    return {
      messages: [
        {
          text: [],
          flash: false,
          marquee: false,
          speed: `0x${speed}0`,
          mode: direction === 'right' ? "0x01" : "0x00",
          invert: false,
        },
      ],
    };
  }

  const finalHexStrings = [];

  for (let i = 0; i < matrix.length; i += CHUNK_WIDTH) {
    let chunk_transpran = matrix.slice(i, i + CHUNK_WIDTH);

    let chunk = [];
    for (let j = 0; j < TARGET_HEIGHT; j++) {
      let newColumn = [];
      for (let k = 0; k < CHUNK_WIDTH; k++) {
        if (chunk_transpran[k] && chunk_transpran[k][j] !== undefined) {
          newColumn.push(chunk_transpran[k][j]);
        } else {
          newColumn.push(0); // If no data, fill with 0
        }
      }
      chunk.push(newColumn);
    }

    // If the block is less than 8 columns, fill it with empty columns
    while (chunk.length < CHUNK_WIDTH) {
      chunk.push(Array(TARGET_HEIGHT).fill(0));
    }

    let chunkHexString = "";
    for (let j = 0; j < TARGET_HEIGHT; j++) {
      let page = chunk[j].join("");
      let hexValue = parseInt(page, 2).toString(16).padStart(2, "0");
      chunkHexString += hexValue;
    }

    finalHexStrings.push(chunkHexString);
  }

  if (finalHexStrings.length < 6) {
    // If less than 6 blocks, supplement with blank blocks
    while (finalHexStrings.length < 6) {
      finalHexStrings.push("0000000000000000000000");
    }
  }

  return {
      messages: [{
          text: finalHexStrings,
          flash: false,
          marquee: false,
          speed: `0x${speed}0`,
          mode: direction === 'right' ? "0x01" : "0x00",
          invert: false
      }]
  };
}