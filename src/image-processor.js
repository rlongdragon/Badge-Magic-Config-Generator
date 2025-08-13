import { TARGET_HEIGHT } from './constants.js';

function analyzeImage(imageDataUrl, onMatrixProcessed) {
    const img = new Image();
    img.onload = () => {
      if (img.height !== TARGET_HEIGHT) {
        // This should be handled by a more robust UI feedback system
        console.error(`Image height must be ${TARGET_HEIGHT} pixels! (Currently ${img.height}px)`);
        return;
      }

      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = img.width;
      analysisCanvas.height = img.height;
      const ctx = analysisCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const matrix = [];
      for (let x = 0; x < img.width; x++) {
        const newRow = [];
        for (let y = 0; y < img.height; y++) {
          const index = (y * img.width + x) * 4;
          const alpha = imageData.data[index + 3];
          const bit = (alpha > 128) ? 1 : 0;
          newRow.push(bit);
        }
        matrix.push(newRow);
      }
      
      onMatrixProcessed(matrix);
    };
    img.onerror = () => {
      // This should be handled by a more robust UI feedback system
      console.error("Could not read image file.");
    };
    img.src = imageDataUrl;
}


export function handleImageFile(files, onMatrixProcessed) {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) {
        console.error("Please upload a valid image file!");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageDataUrl = event.target.result;
        analyzeImage(imageDataUrl, onMatrixProcessed);
    };
    reader.readAsDataURL(file);
}