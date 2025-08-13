document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("text-input");
  const svgContainer = document.getElementById("svg-container");
  const debugCanvas = document.getElementById("font-canvas");
  const modeToggles = document.querySelectorAll('input[name="mode"]');
  const textModeContent = document.getElementById("text-mode-content");
  const imageModeContent = document.getElementById("image-mode-content");
  const imageDropZone = document.getElementById("image-drop-zone");
  const imageInput = document.getElementById("image-input");
  const imagePreviewCanvas = document.getElementById("image-preview-canvas");
  const marqueePreview = document.getElementById("marquee-preview");
  const textPreview = document.getElementById("text-preview");
  const previewToggles = document.querySelectorAll('input[name="preview-toggle"]');
  const directionToggles = document.querySelectorAll('input[name="direction"]');
  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  const debugCtx = debugCanvas.getContext("2d");
  const previewControls = document.querySelector(".preview-controls");
  const svgPixelSize = 10;
 
  const renderCanvas = document.createElement("canvas");
  const renderCtx = renderCanvas.getContext("2d");

  function analyzeAndDraw() {
    const text = input.value;
    if (!text) {
      processMatrix([]); // Pass empty matrix to clear everything
      return;
    }

    const baseFontSize = 12;
    const renderWidth = 300;
    const renderHeight = 30;
    renderCanvas.width = renderWidth;
    renderCanvas.height = renderHeight;

    renderCtx.font = `${baseFontSize}px "Cubic 11"`;
    renderCtx.textBaseline = "top";
    renderCtx.fillStyle = "#000";
    renderCtx.imageSmoothingEnabled = false;
    renderCtx.fillText(text, 0, 0);

    const imageData = renderCtx.getImageData(0, 0, renderWidth, renderHeight);
    const data = imageData.data;

    let minX = renderWidth,
      minY = renderHeight,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < renderHeight; y++) {
      for (let x = 0; x < renderWidth; x++) {
        const alpha = data[(y * renderWidth + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) {
      processMatrix([]);
      return;
    }

    const visualWidth = maxX - minX + 1;
    const visualHeight = maxY - minY + 1;

    const matrix = [];
    for (let x = 0; x < visualWidth; x++) {
      const newRow = [];
      for (let y = 0; y < visualHeight; y++) {
        const canvasX = minX + x;
        const canvasY = minY + y;
        const alpha = data[(canvasY * renderWidth + canvasX) * 4 + 3];
        newRow.push(alpha > 128 ? 1 : 0);
      }
      matrix.push(newRow);
    }
    
    processMatrix(matrix);
  }

  function processMatrix(matrix) {
    if (!matrix || matrix.length === 0) {
      svgContainer.innerHTML = "";
      debugCanvas.width = 0;
      debugCanvas.height = 0;
      const outputContainer = document.getElementById("output-container");
      if (outputContainer) outputContainer.textContent = '';
      return;
    }

    const visualWidth = matrix.length;
    const visualHeight = 11;

    debugCanvas.width = visualWidth * svgPixelSize;
    debugCanvas.height = visualHeight * svgPixelSize;
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugCtx.fillStyle = "#000";
    for (let y = 0; y < visualHeight; y++) {
      for (let x = 0; x < visualWidth; x++) {
        if (matrix[x] && matrix[x][y] === 1) {
          debugCtx.fillRect(
            x * svgPixelSize,
            y * svgPixelSize,
            svgPixelSize,
            svgPixelSize
          );
        }
      }
    }

    const padding = svgPixelSize * 0.5;
    const svgWidth = visualWidth * svgPixelSize + padding;
    const svgHeight = visualHeight * svgPixelSize + padding;
    const offsetX = padding / 2;
    const offsetY = padding / 2;

    let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="image-rendering: pixelated;">`;
    for (let y = 0; y < visualHeight; y++) {
      for (let x = 0; x < visualWidth; x++) {
        const scaleFactor = 0.45;
        const aspectRatio = 2.4;
        const rectWidth = svgPixelSize * aspectRatio * scaleFactor;
        const rectHeight = svgPixelSize * scaleFactor;
        const centerX = offsetX + x * svgPixelSize + svgPixelSize / 2;
        const centerY = offsetY + y * svgPixelSize + svgPixelSize / 2;
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

    // console.log(matrix);

    const outputContainer =
      document.getElementById("output-container") || createOutputContainer();
    const direction = document.querySelector('input[name="direction"]:checked').value;
    const speed = parseInt(speedSlider.value, 10) - 1; // 0-7
    const hexDisplayData = convertMatrixToHexDisplay(matrix, direction, speed);
    outputContainer.textContent = JSON.stringify(hexDisplayData, null, 2);
  }

  document.fonts.ready.then(() => {
    // console.log("字體已載入，採用 12px 渲染尺寸開始分析...");
    analyzeAndDraw();
  });

  input.addEventListener("input", analyzeAndDraw);
  directionToggles.forEach(toggle => toggle.addEventListener('change', ()=>{
    let data = JSON.parse(document.getElementById("output-container").textContent || '{}');
    data.messages[0].mode = toggle.value === 'right' ? "0x01" : "0x00";
    document.getElementById("output-container").textContent = JSON.stringify(data, null, 2);
  }));
  speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
    // analyzeAndDraw();
    let data = JSON.parse(document.getElementById("output-container").textContent || '{}');

    data.messages[0].speed = `0x${speedSlider.value-1}0`;

    document.getElementById("output-container").textContent = JSON.stringify(
      data,
      null,
      2
    );
  });
 
  previewToggles.forEach(toggle => {
    toggle.addEventListener('change', (event) => {
        if (event.target.value === 'marquee') {
            marqueePreview.style.display = 'block';
            textPreview.style.display = 'none';
        } else {
            marqueePreview.style.display = 'none';
            textPreview.style.display = 'block';
        }
    });
  });

  // --- Mode Switching ---
  modeToggles.forEach(toggle => {
    toggle.addEventListener('change', (event) => {
      const mode = event.target.value;
      if (mode === 'text') {
        textModeContent.style.display = 'block';
        imageModeContent.style.display = 'none';
        previewControls.style.display = 'flex'; // Show preview controls
        // Clear image preview and results when switching back to text
        clearImageState();
      } else {
        textModeContent.style.display = 'none';
        imageModeContent.style.display = 'block';
        previewControls.style.display = 'none'; // Hide preview controls
        // Clear text input and results when switching to image
        clearTextState();
      }
    });
  });

  function clearTextState() {
    input.value = '';
    analyzeAndDraw(); // This will clear the previews
  }

  function clearImageState() {
    imageInput.value = ''; // Reset file input
    imagePreviewCanvas.style.display = 'none';
    // You might want to clear the matrix and output here as well
    // For now, we'll rely on the next analysis to overwrite it.
  }

  // --- Image Uploading ---
  imageDropZone.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleImageFile(files);
    }
  });

  imageDropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    imageDropZone.classList.add('dragover');
  });

  imageDropZone.addEventListener('dragleave', () => {
    imageDropZone.classList.remove('dragover');
  });

  imageDropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    imageDropZone.classList.remove('dragover');
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageFile(files);
    }
  });

  window.addEventListener('paste', (event) => {
    const files = event.clipboardData.files;
    // Check if we are in image mode and a file is pasted
    if (imageModeContent.style.display === 'block' && files && files.length > 0 && files.type.startsWith('image/')) {
      handleImageFile(files);
    }
  });

  function handleImageFile(files) {
    const file = files[0]; // Get the first file from the list
    if (!file || !file.type.startsWith("image/")) {
      showError("請上傳有效的圖片檔案！");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageDataUrl = event.target.result;

      // --- Instant Preview ---
      const previewCtx = imagePreviewCanvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        imagePreviewCanvas.width = img.width;
        imagePreviewCanvas.height = img.height;
        previewCtx.drawImage(img, 0, 0);
        imagePreviewCanvas.style.display = "block";
      };
      img.src = imageDataUrl;
      // --- End Instant Preview ---

      analyzeImage(imageDataUrl);
    };
    reader.readAsDataURL(file);
  }

  function analyzeImage(imageDataUrl) {
    const img = new Image();
    img.onload = () => {
      // 1. Validate image height
      if (img.height !== 11) {
        showError(`圖片高度必須為 11 像素！(目前為 ${img.height}px)`);
        return;
      }

      // 2. Draw to an in-memory canvas
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = img.width;
      analysisCanvas.height = img.height;
      const ctx = analysisCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 3. Analyze pixels and create matrix
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const matrix = [];
      for (let x = 0; x < img.width; x++) {
        const newRow = [];
        for (let y = 0; y < img.height; y++) {
          const index = (y * img.width + x) * 4;
          const alpha = imageData.data[index + 3];
          const bit = (alpha > 128) ? 1 : 0; // Use a threshold for alpha
          newRow.push(bit);
        }
        matrix.push(newRow);
      }

      // 4. Pass to the next stage (to be implemented)
      processMatrix(matrix);
    };
    img.onerror = () => {
      showError("無法讀取圖片檔案。");
    };
    img.src = imageDataUrl;
  }

  function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger the animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Remove the toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500); // Wait for fade out transition
    }, 3000);
  }

  const downloadBtn = document.getElementById("download-btn");
  downloadBtn.addEventListener("click", () => {
    const outputContainer = document.getElementById("output-container");
    if (!outputContainer || !outputContainer.textContent) {
      alert("沒有可下載的資料！");
      return;
    }

    const dataStr = outputContainer.textContent;
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份是從 0 開始的
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const fileName = `badge_${day}${month}-${hours}_${minutes}.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
});

function createOutputContainer() {
  let container = document.getElementById("output-container");
  if (!container) {
    container = document.createElement("pre");
    container.id = "output-container";
    const downloadBtn = document.getElementById("download-btn");
    // Insert the container before the download button so it appears above it.
    downloadBtn.parentNode.insertBefore(container, downloadBtn);
  }
  return container;
}

function convertMatrixToHexDisplay(matrix, direction, speed) {
  const TARGET_HEIGHT = 11;
  const CHUNK_WIDTH = 8;
 
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
          newColumn.push(0); // 如果沒有資料，填充0
        }
      }
      chunk.push(newColumn);
    }

    // console.log(`處理區塊 ${i / CHUNK_WIDTH + 1}:`, chunk);

    // 如果區塊不足8欄，用空欄補滿
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
    // 如果不足6個區塊，補充空白區塊
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
