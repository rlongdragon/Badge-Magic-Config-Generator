import { TARGET_HEIGHT } from './constants.js';

function analyzeImage(imageDataUrl, onMatrixProcessed, onError) {
    const img = new Image();
    img.onload = () => {
      if (img.height !== TARGET_HEIGHT) {
        onError(`圖片高度必須是 ${TARGET_HEIGHT} 像素（目前是 ${img.height} 像素）`);
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
      onError("無法讀取圖片檔案");
    };
    img.src = imageDataUrl;
}


export function handleImageFile(files, onMatrixProcessed, onError = console.error) {
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) {
        onError("請選擇圖片檔案");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const imageDataUrl = event.target.result;
        analyzeImage(imageDataUrl, onMatrixProcessed, onError);
    };
    reader.readAsDataURL(file);
}