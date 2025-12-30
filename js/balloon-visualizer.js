/**
 * Phoenix Balloon Decor - AI Visualization Tool
 * Connects to backend API for Gemini-powered balloon visualization
 */

const BalloonVisualizer = (() => {
  // Configuration
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : ''; // Same origin in production

  // Balloon colors
  const BALLOON_COLORS = [
    { name: 'Pastel Pink', hex: '#FFD1DC' },
    { name: 'Light Blue', hex: '#ADD8E6' },
    { name: 'Mint Green', hex: '#98FF98' },
    { name: 'Lavender', hex: '#E6E6FA' },
    { name: 'Butter Yellow', hex: '#FFFACD' },
    { name: 'Shiny Gold', hex: '#FFD700' },
    { name: 'Chrome Silver', hex: '#C0C0C0' },
    { name: 'Rose Gold', hex: '#B76E79' },
    { name: 'Royal Blue', hex: '#4169E1' },
    { name: 'Emerald Green', hex: '#50C878' },
    { name: 'Classic Red', hex: '#FF0000' },
    { name: 'Matte White', hex: '#F5F5F5' },
    { name: 'Glossy Black', hex: '#1a1a1a' },
    { name: 'Terracotta', hex: '#E2725B' },
    { name: 'Beige', hex: '#F5F5DC' }
  ];

  // Balloon styles with prompts
  const BALLOON_STYLES = [
    {
      id: 'classic-garland',
      name: 'Classic Garland',
      description: 'Full balloon garland, perfect for entryways and backdrops',
      prompt: 'Add a beautiful, full balloon garland arch using the colors {colors} to the main area of this image. Make it look realistic, celebratory, and elegantly attached to the wall or structure.'
    },
    {
      id: 'boho-arch',
      name: 'Boho Chic Arch',
      description: 'Elegant arch with pampas grass accents',
      prompt: 'Integrate a stylish boho-themed balloon arch into the image using the colors {colors}. Add some dried pampas grass accents within the balloons for a chic, textured look. Ensure it fits the space naturally.'
    },
    {
      id: 'dynamic-splash',
      name: 'Dynamic Splash',
      description: 'Energetic explosion of balloons for celebrations',
      prompt: 'Create a vibrant splash of balloons in the photo using the colors {colors}. The arrangement should be dynamic and asymmetrical, like a joyful explosion of color. Include balloons of various sizes.'
    },
    {
      id: 'sleek-modern',
      name: 'Sleek & Modern',
      description: 'Sophisticated arrangement for formal events',
      prompt: 'Add a sophisticated and elegant balloon arrangement using shades of {colors}. The design should be sleek and modern, perhaps a half-arch or a pillar, suitable for a formal event.'
    },
    {
      id: 'whimsical-theme',
      name: 'Whimsical Theme',
      description: 'Creative design with bubble balloons',
      prompt: 'Transform the space with a whimsical themed balloon decoration using the colors {colors}. Incorporate clear balloons to look like bubbles and maybe some twisted balloons to suggest unique shapes.'
    }
  ];

  // State
  let state = {
    uploadedImage: null,
    uploadedFile: null,
    selectedColors: [],
    selectedStyle: null,
    generatedImage: null,
    priceInfo: null,
    isLoading: false
  };

  // DOM Elements
  let elements = {};

  // Initialize the visualizer
  function init() {
    createVisualizerUI();
    bindEvents();
    fetchPrices();
  }

  // Fetch prices from server
  async function fetchPrices() {
    try {
      const res = await fetch(`${API_BASE}/api/prices`);
      if (res.ok) {
        const prices = await res.json();
        // Update styles with prices
        BALLOON_STYLES.forEach(style => {
          if (prices[style.id]) {
            style.price = prices[style.id].price;
          }
        });
        renderStyleSelector();
      }
    } catch (e) {
      console.log('Could not fetch prices, using defaults');
    }
  }

  // Create the visualizer UI
  function createVisualizerUI() {
    const container = document.getElementById('ai-visualizer-app');
    if (!container) return;

    container.innerHTML = `
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Left Panel: Controls -->
        <div class="space-y-4">
          <!-- Step 1: Upload -->
          <div class="bg-white rounded-xl p-4 shadow-sm">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center font-bold text-xs">1</div>
              <h3 class="font-semibold text-dark text-sm">Upload Your Space</h3>
            </div>
            <div id="upload-area" class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-teal transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p class="text-xs text-gray-500">Click or drag to upload</p>
            </div>
            <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" class="hidden">
            <div id="upload-preview" class="hidden mt-3">
              <img id="preview-image" class="w-full h-32 object-cover rounded-lg">
              <button id="clear-upload" class="mt-1 text-xs text-gray-500 hover:text-red-500">Remove</button>
            </div>
          </div>

          <!-- Step 2: Colors -->
          <div class="bg-white rounded-xl p-4 shadow-sm">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center font-bold text-xs">2</div>
                <h3 class="font-semibold text-dark text-sm">Choose Colors</h3>
              </div>
              <p id="color-count" class="text-xs text-gray-400">0/3</p>
            </div>
            <div id="color-grid" class="grid grid-cols-5 gap-1.5"></div>
          </div>

          <!-- Step 3: Style -->
          <div class="bg-white rounded-xl p-4 shadow-sm">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center font-bold text-xs">3</div>
              <h3 class="font-semibold text-dark text-sm">Select Style</h3>
            </div>
            <div id="style-selector" class="space-y-1.5"></div>
          </div>

          <!-- Generate Button -->
          <button id="generate-btn" class="w-full btn-primary py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span>Generate Visualization</span>
          </button>
        </div>

        <!-- Right Panel: Result -->
        <div class="bg-white rounded-2xl p-4 shadow-sm flex flex-col">
          <h3 class="font-semibold text-dark mb-3 text-sm">AI Preview</h3>

          <!-- Loading State -->
          <div id="loading-state" class="hidden py-20 flex flex-col items-center justify-center">
            <div class="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin mb-3"></div>
            <p id="loading-text" class="text-gray-500 text-sm">Generating your visualization...</p>
          </div>

          <!-- Empty State -->
          <div id="empty-state" class="py-16 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="text-gray-500 text-sm">Your AI-generated preview will appear here</p>
            <p class="text-xs text-gray-400 mt-1">Upload a photo, select colors & style, then generate</p>
          </div>

          <!-- Result State -->
          <div id="result-state" class="hidden">
            <div class="relative mb-3">
              <img id="result-image" class="w-full rounded-xl">
              <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold tracking-wider text-teal">
                AI GENERATED
              </div>
            </div>

            <!-- Quote Panel - Compact -->
            <div id="quote-panel" class="p-3 bg-gray-50 rounded-xl">
              <div class="flex justify-between items-center mb-2">
                <div>
                  <p class="font-semibold text-dark text-sm" id="quote-style-name">Classic Garland</p>
                  <p class="text-xs text-gray-500" id="quote-colors">Colors: Pastel Pink, Light Blue</p>
                </div>
                <p class="text-xl font-bold text-teal" id="quote-price">$250</p>
              </div>
              <p class="text-xs text-gray-400 mb-2">*Price is an estimate. Final quote may vary based on venue size and complexity.</p>
              <div class="flex gap-2">
                <button id="download-image-btn" class="flex-1 btn-outline py-1.5 rounded-lg text-xs flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Image
                </button>
                <button id="download-quote-btn" class="flex-1 btn-primary py-1.5 rounded-lg text-xs flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Quote
                </button>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div id="error-state" class="hidden flex-1 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p class="text-gray-700 font-medium">Oops! Something went wrong</p>
            <p id="error-message" class="text-sm text-gray-500 mt-1">Please try again</p>
            <button id="retry-btn" class="mt-4 btn-outline py-2 px-6 rounded-lg text-sm">Try Again</button>
          </div>
        </div>
      </div>
    `;

    // Cache DOM elements
    elements = {
      uploadArea: document.getElementById('upload-area'),
      fileInput: document.getElementById('file-input'),
      uploadPreview: document.getElementById('upload-preview'),
      previewImage: document.getElementById('preview-image'),
      clearUpload: document.getElementById('clear-upload'),
      colorGrid: document.getElementById('color-grid'),
      colorCount: document.getElementById('color-count'),
      styleSelector: document.getElementById('style-selector'),
      generateBtn: document.getElementById('generate-btn'),
      loadingState: document.getElementById('loading-state'),
      loadingText: document.getElementById('loading-text'),
      emptyState: document.getElementById('empty-state'),
      resultState: document.getElementById('result-state'),
      errorState: document.getElementById('error-state'),
      errorMessage: document.getElementById('error-message'),
      resultImage: document.getElementById('result-image'),
      quoteStyleName: document.getElementById('quote-style-name'),
      quoteColors: document.getElementById('quote-colors'),
      quotePrice: document.getElementById('quote-price'),
      downloadImageBtn: document.getElementById('download-image-btn'),
      downloadQuoteBtn: document.getElementById('download-quote-btn'),
      retryBtn: document.getElementById('retry-btn')
    };

    // Render color grid
    renderColorGrid();
    renderStyleSelector();
  }

  // Render color selection grid
  function renderColorGrid() {
    elements.colorGrid.innerHTML = BALLOON_COLORS.map(color => `
      <button
        class="color-btn w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform relative"
        style="background-color: ${color.hex}"
        data-color="${color.name}"
        data-hex="${color.hex}"
        title="${color.name}">
        <span class="check-mark hidden absolute inset-0 flex items-center justify-center text-white text-sm font-bold" style="text-shadow: 0 1px 2px rgba(0,0,0,0.5)">✓</span>
      </button>
    `).join('');
  }

  // Render style selector
  function renderStyleSelector() {
    elements.styleSelector.innerHTML = BALLOON_STYLES.map(style => `
      <button
        class="style-btn w-full p-2 rounded-lg border border-gray-200 hover:border-teal text-left transition-colors"
        data-style-id="${style.id}">
        <div class="flex justify-between items-center">
          <p class="font-medium text-dark text-sm">${style.name}</p>
          ${style.price ? `<span class="text-teal font-bold text-sm">$${style.price}</span>` : ''}
        </div>
      </button>
    `).join('');
  }

  // Bind event handlers
  function bindEvents() {
    // File upload
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.clearUpload.addEventListener('click', clearUpload);

    // Color selection
    elements.colorGrid.addEventListener('click', handleColorClick);

    // Style selection
    elements.styleSelector.addEventListener('click', handleStyleClick);

    // Generate
    elements.generateBtn.addEventListener('click', generateVisualization);

    // Downloads
    elements.downloadImageBtn.addEventListener('click', downloadImage);
    elements.downloadQuoteBtn.addEventListener('click', downloadQuote);

    // Retry
    elements.retryBtn.addEventListener('click', () => showState('empty'));
  }

  // File handling
  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-teal', 'bg-teal/5');
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('border-teal', 'bg-teal/5');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-teal', 'bg-teal/5');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  function processFile(file) {
    if (!file.type.match(/image\/(jpeg|png|webp)/)) {
      alert('Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    state.uploadedFile = file;
    state.uploadedImage = URL.createObjectURL(file);
    elements.previewImage.src = state.uploadedImage;
    elements.uploadArea.classList.add('hidden');
    elements.uploadPreview.classList.remove('hidden');
    updateGenerateButton();
  }

  function clearUpload() {
    if (state.uploadedImage) {
      URL.revokeObjectURL(state.uploadedImage);
    }
    state.uploadedFile = null;
    state.uploadedImage = null;
    elements.fileInput.value = '';
    elements.uploadArea.classList.remove('hidden');
    elements.uploadPreview.classList.add('hidden');
    updateGenerateButton();
  }

  // Color handling
  function handleColorClick(e) {
    const btn = e.target.closest('.color-btn');
    if (!btn) return;

    const colorName = btn.dataset.color;
    const colorHex = btn.dataset.hex;
    const checkMark = btn.querySelector('.check-mark');
    const isSelected = state.selectedColors.find(c => c.name === colorName);

    if (isSelected) {
      // Deselect
      state.selectedColors = state.selectedColors.filter(c => c.name !== colorName);
      btn.classList.remove('ring-2', 'ring-offset-2', 'ring-teal');
      checkMark.classList.add('hidden');
    } else if (state.selectedColors.length < 3) {
      // Select
      state.selectedColors.push({ name: colorName, hex: colorHex });
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-teal');
      checkMark.classList.remove('hidden');
    }

    elements.colorCount.textContent = `${state.selectedColors.length}/3`;
    updateGenerateButton();
  }

  // Style handling
  function handleStyleClick(e) {
    const btn = e.target.closest('.style-btn');
    if (!btn) return;

    // Remove selection from all
    document.querySelectorAll('.style-btn').forEach(b => {
      b.classList.remove('border-teal', 'bg-teal/5');
      b.classList.add('border-gray-200');
    });

    // Select clicked
    btn.classList.remove('border-gray-200');
    btn.classList.add('border-teal', 'bg-teal/5');

    state.selectedStyle = BALLOON_STYLES.find(s => s.id === btn.dataset.styleId);
    updateGenerateButton();
  }

  // Update generate button state
  function updateGenerateButton() {
    const canGenerate = state.uploadedFile && state.selectedColors.length > 0 && state.selectedStyle;
    elements.generateBtn.disabled = !canGenerate;
  }

  // Show different states
  function showState(stateName) {
    elements.loadingState.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.resultState.classList.add('hidden');
    elements.errorState.classList.add('hidden');

    switch (stateName) {
      case 'loading':
        elements.loadingState.classList.remove('hidden');
        break;
      case 'result':
        elements.resultState.classList.remove('hidden');
        break;
      case 'error':
        elements.errorState.classList.remove('hidden');
        break;
      default:
        elements.emptyState.classList.remove('hidden');
    }
  }

  // Generate visualization
  async function generateVisualization() {
    if (state.isLoading) return;

    state.isLoading = true;
    showState('loading');
    elements.generateBtn.disabled = true;

    // Loading messages
    const loadingMessages = [
      'Inflating your vision...',
      'Adding the final touches...',
      'Tying up the perfect look...',
      'Getting the party started...'
    ];
    let msgIndex = 0;
    const loadingInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % loadingMessages.length;
      elements.loadingText.textContent = loadingMessages[msgIndex];
    }, 2000);

    try {
      // Build color string
      const colorNames = state.selectedColors.map(c => c.name);
      let colorString;
      if (colorNames.length === 1) {
        colorString = colorNames[0];
      } else if (colorNames.length === 2) {
        colorString = `${colorNames[0]} and ${colorNames[1]}`;
      } else {
        colorString = `${colorNames[0]}, ${colorNames[1]}, and ${colorNames[2]}`;
      }

      // Build prompt
      const prompt = state.selectedStyle.prompt.replace('{colors}', colorString);

      // Create form data
      const formData = new FormData();
      formData.append('image', state.uploadedFile);
      formData.append('prompt', prompt);
      formData.append('styleId', state.selectedStyle.id);
      formData.append('colors', JSON.stringify(state.selectedColors));

      // Send request
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate visualization');
      }

      // Success
      state.generatedImage = data.image;
      state.priceInfo = data.price;

      elements.resultImage.src = data.image;
      elements.quoteStyleName.textContent = state.selectedStyle.name;
      elements.quoteColors.textContent = `Colors: ${colorNames.join(', ')}`;
      elements.quotePrice.textContent = state.priceInfo ? `$${state.priceInfo.price}` : 'Quote on request';

      showState('result');

    } catch (error) {
      console.error('Generation error:', error);
      elements.errorMessage.textContent = error.message;
      showState('error');
    } finally {
      clearInterval(loadingInterval);
      state.isLoading = false;
      updateGenerateButton();
    }
  }

  // Download image
  function downloadImage() {
    if (!state.generatedImage) return;

    const link = document.createElement('a');
    link.href = state.generatedImage;
    link.download = `phoenix-balloon-visualization-${Date.now()}.png`;
    link.click();
  }

  // Download quote as PDF
  async function downloadQuote() {
    if (!state.generatedImage) return;

    // For now, generate a simple HTML-based printable quote
    // In production, you might use a library like jsPDF
    const colorNames = state.selectedColors.map(c => c.name).join(', ');
    const price = state.priceInfo ? `$${state.priceInfo.price}` : 'Quote on request';

    const quoteHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phoenix Balloon Decor - Quote</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1A5E63; padding-bottom: 20px; }
          .header h1 { color: #1A5E63; margin: 0; font-size: 28px; }
          .header p { color: #666; margin-top: 5px; }
          .image-container { text-align: center; margin: 30px 0; }
          .image-container img { max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .details { background: #f9f9f9; padding: 24px; border-radius: 12px; margin: 30px 0; }
          .details h2 { color: #1A5E63; margin-top: 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .price { font-size: 32px; color: #1A5E63; font-weight: bold; text-align: right; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .disclaimer { font-size: 12px; color: #999; margin-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Phoenix Balloon Decor</h1>
          <p>Excellence in Every Detail</p>
        </div>

        <div class="image-container">
          <img src="${state.generatedImage}" alt="AI Visualization">
        </div>

        <div class="details">
          <h2>Quote Details</h2>
          <div class="detail-row">
            <span>Style</span>
            <strong>${state.selectedStyle.name}</strong>
          </div>
          <div class="detail-row">
            <span>Colors</span>
            <strong>${colorNames}</strong>
          </div>
          <div class="detail-row">
            <span>Estimated Price</span>
            <span class="price">${price}</span>
          </div>
        </div>

        <p class="disclaimer">*This is an AI-generated visualization. Final installation may vary. Price is an estimate and may change based on venue size, complexity, and specific requirements. Contact us for a detailed quote.</p>

        <div class="footer">
          <p><strong>Phoenix Balloon Decor</strong></p>
          <p>hello@phoenixballoons.com</p>
          <p>Quote generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window for printing/saving
    const printWindow = window.open('', '_blank');
    printWindow.document.write(quoteHTML);
    printWindow.document.close();

    // Trigger print dialog after images load
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
  }

  // Public API
  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', BalloonVisualizer.init);
