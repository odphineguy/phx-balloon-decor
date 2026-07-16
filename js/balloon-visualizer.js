/**
 * AI Visualization Tool — tenant-config-driven.
 *
 * Fetches /api/config at load (branding, theme, colors, styles WITHOUT
 * prompts — prompt templates live server-side only) and renders the whole
 * visualizer from it. Generation sends styleId + colors; the server builds
 * the prompt. When the tenant's leadGate is enabled, the generated render is
 * shown blurred behind a lead form and revealed on submit — regardless of
 * whether the lead POST succeeds (never lose the demo moment).
 */

const BalloonVisualizer = (() => {
  // Configuration
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : ''; // Same origin in production

  const DEFAULT_FONTS = ['Playfair Display', 'Montserrat']; // already linked in index.html

  // State
  let config = null;
  let state = {
    uploadedImage: null,
    uploadedFile: null,
    uploadedWidth: null,
    uploadedHeight: null,
    selectedColors: [],
    selectedStyle: null,
    generatedImage: null,
    priceInfo: null,
    isLoading: false,
    isRevealed: false
  };

  // DOM Elements
  let elements = {};

  // Initialize the visualizer
  async function init() {
    config = await fetchConfig();
    if (!config) {
      renderConfigError();
      return;
    }
    applyBranding(config);
    createVisualizerUI();
    bindEvents();
  }

  // Fetch tenant config from server
  async function fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Could not fetch tenant config', e);
      return null;
    }
  }

  function renderConfigError() {
    const container = document.getElementById('ai-visualizer-app');
    if (!container) return;
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 shadow-sm text-center">
        <p class="text-gray-700 font-medium">The visualizer is taking a quick break.</p>
        <p class="text-sm text-gray-500 mt-1">Please refresh the page to try again.</p>
      </div>
    `;
  }

  // Apply tenant branding to the whole page (theme vars, fonts, logo, copy)
  function applyBranding(cfg) {
    const root = document.documentElement;
    const theme = cfg.theme || {};

    if (theme.primary) root.style.setProperty('--teal', theme.primary);
    if (theme.accent) root.style.setProperty('--gold', theme.accent);
    if (theme.bg) root.style.setProperty('--off-white', theme.bg);
    if (theme.text) root.style.setProperty('--dark', theme.text);
    if (theme.headingFont) root.style.setProperty('--heading-font', `'${theme.headingFont}', serif`);
    if (theme.bodyFont) root.style.setProperty('--body-font', `'${theme.bodyFont}', sans-serif`);

    // Load tenant fonts from Google Fonts when they differ from the defaults
    // already linked in index.html.
    const fonts = [theme.headingFont, theme.bodyFont]
      .filter(f => f && !DEFAULT_FONTS.includes(f));
    if (fonts.length) {
      const families = fonts
        .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700`)
        .join('&');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      document.head.appendChild(link);
    }

    if (cfg.businessName) {
      document.title = `${cfg.businessName}${cfg.tagline ? ' | ' + cfg.tagline : ''}`;
    }
    document.querySelectorAll('[data-tenant="logo"]').forEach(el => {
      if (cfg.logo) el.src = cfg.logo;
      if (cfg.businessName) el.alt = cfg.businessName;
    });
    document.querySelectorAll('[data-tenant="business-name"]').forEach(el => {
      if (cfg.businessName) el.textContent = cfg.businessName;
    });
    document.querySelectorAll('[data-tenant="contact-email"]').forEach(el => {
      const email = cfg.contact && cfg.contact.email;
      if (!email) return;
      el.textContent = email;
      if (el.tagName === 'A') el.href = `mailto:${email}`;
    });
    document.querySelectorAll('[data-tenant="visualizer-kicker"]').forEach(el => {
      if (cfg.ui && cfg.ui.visualizerKicker) el.textContent = cfg.ui.visualizerKicker;
    });
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
            <div class="relative mb-3 overflow-hidden rounded-xl">
              <img id="result-image" class="w-full rounded-xl transition-all duration-700">
              <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold tracking-wider text-teal">
                AI GENERATED
              </div>

              <!-- Lead Gate Overlay -->
              <div id="lead-gate" class="hidden absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center p-4">
                <form id="lead-form" class="bg-white/95 backdrop-blur rounded-xl shadow-lg p-5 w-full max-w-sm">
                  <p class="font-semibold text-dark text-sm mb-1">Your design is ready!</p>
                  <p class="text-xs text-gray-500 mb-4">Tell us where to send your free estimate and we'll reveal it instantly.</p>
                  <div id="lead-fields" class="space-y-2.5"></div>
                  <p id="lead-error" class="hidden text-xs text-red-500 mt-2">Please fill in your name, email, and phone.</p>
                  <button type="submit" class="w-full btn-primary py-2.5 rounded-lg font-semibold text-sm mt-4">Reveal My Design</button>
                </form>
              </div>
            </div>

            <!-- Quote Panel - Compact -->
            <div id="quote-panel" class="hidden p-3 bg-gray-50 rounded-xl">
              <div class="flex justify-between items-center mb-2">
                <div>
                  <p class="font-semibold text-dark text-sm" id="quote-style-name">Classic Garland</p>
                  <p class="text-xs text-gray-500" id="quote-colors">Colors: Pastel Pink, Light Blue</p>
                </div>
                <p class="text-xl font-bold text-teal" id="quote-price">$250</p>
              </div>
              <p class="text-xs text-gray-400 mb-2">*Price is an estimate. Final quote may vary based on venue size and complexity.</p>
              <a href="#contact" id="book-now-btn" class="block w-full btn-primary py-2 rounded-lg text-sm text-center font-semibold mb-2">Book Now</a>
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
      leadGate: document.getElementById('lead-gate'),
      leadForm: document.getElementById('lead-form'),
      leadFields: document.getElementById('lead-fields'),
      leadError: document.getElementById('lead-error'),
      quotePanel: document.getElementById('quote-panel'),
      quoteStyleName: document.getElementById('quote-style-name'),
      quoteColors: document.getElementById('quote-colors'),
      quotePrice: document.getElementById('quote-price'),
      downloadImageBtn: document.getElementById('download-image-btn'),
      downloadQuoteBtn: document.getElementById('download-quote-btn'),
      retryBtn: document.getElementById('retry-btn')
    };

    renderColorGrid();
    renderStyleSelector();
    renderLeadFields();
  }

  // Render color selection grid from tenant config
  function renderColorGrid() {
    elements.colorGrid.innerHTML = (config.colors || []).map(color => `
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

  // Render style selector from tenant config
  function renderStyleSelector() {
    elements.styleSelector.innerHTML = (config.styles || []).map(style => `
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

  // Render lead-gate form inputs from tenant config
  function renderLeadFields() {
    const FIELDS = {
      name: { type: 'text', placeholder: 'Your name', autocomplete: 'name', required: true },
      email: { type: 'email', placeholder: 'Email address', autocomplete: 'email', required: true },
      phone: { type: 'tel', placeholder: 'Phone number', autocomplete: 'tel', required: true },
      eventDate: { type: 'date', placeholder: 'Event date', autocomplete: 'off', required: false, label: 'Event date (optional)' }
    };
    const wanted = (config.leadGate && config.leadGate.fields) || [];
    elements.leadFields.innerHTML = wanted.filter(f => FIELDS[f]).map(f => {
      const def = FIELDS[f];
      const label = def.label ? `<label class="block text-[11px] text-gray-400 mb-0.5" for="lead-${f}">${def.label}</label>` : '';
      return `${label}<input id="lead-${f}" name="${f}" type="${def.type}" placeholder="${def.placeholder}"
        autocomplete="${def.autocomplete}" ${def.required ? 'required' : ''}
        class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal">`;
    }).join('');
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

    // Lead gate
    elements.leadForm.addEventListener('submit', handleLeadSubmit);

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
    // Capture source dimensions so the server can pick the closest output
    // aspect ratio for the render.
    const probe = new Image();
    probe.onload = () => {
      state.uploadedWidth = probe.naturalWidth;
      state.uploadedHeight = probe.naturalHeight;
    };
    probe.src = state.uploadedImage;
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
    state.uploadedWidth = null;
    state.uploadedHeight = null;
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

    state.selectedStyle = (config.styles || []).find(s => s.id === btn.dataset.styleId);
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
      // The server owns the prompt — send only the selections.
      const formData = new FormData();
      formData.append('image', state.uploadedFile);
      formData.append('styleId', state.selectedStyle.id);
      formData.append('colors', JSON.stringify(state.selectedColors));
      if (state.uploadedWidth) formData.append('width', state.uploadedWidth);
      if (state.uploadedHeight) formData.append('height', state.uploadedHeight);

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

      const colorNames = state.selectedColors.map(c => c.name);
      elements.resultImage.src = data.image;
      elements.quoteStyleName.textContent = state.selectedStyle.name;
      elements.quoteColors.textContent = `Colors: ${colorNames.join(', ')}`;
      elements.quotePrice.textContent = state.priceInfo ? `$${state.priceInfo.price}` : 'Quote on request';

      if (config.leadGate && config.leadGate.enabled && !state.isRevealed) {
        lockResult();
      } else {
        revealResult();
      }
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

  // Lead gate: blur the render behind the form
  function lockResult() {
    elements.resultImage.classList.add('blur-lg', 'scale-105');
    elements.leadGate.classList.remove('hidden');
    elements.quotePanel.classList.add('hidden');
  }

  function revealResult() {
    elements.resultImage.classList.remove('blur-lg', 'scale-105');
    elements.leadGate.classList.add('hidden');
    elements.quotePanel.classList.remove('hidden');
  }

  async function handleLeadSubmit(e) {
    e.preventDefault();

    const value = (f) => {
      const input = document.getElementById(`lead-${f}`);
      return input ? input.value.trim() : '';
    };
    const lead = {
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      eventDate: value('eventDate') || null,
      styleId: state.selectedStyle ? state.selectedStyle.id : null,
      colors: state.selectedColors,
      renderIncluded: Boolean(state.generatedImage)
    };

    if (!lead.name || !lead.email || !lead.phone) {
      elements.leadError.classList.remove('hidden');
      return;
    }
    elements.leadError.classList.add('hidden');

    // Reveal FIRST — the customer's moment never depends on the lead call
    // surviving ad blockers or network hiccups.
    state.isRevealed = true;
    revealResult();

    try {
      await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
    } catch (error) {
      console.error('Lead submit failed (render already revealed):', error);
    }
  }

  // Download image
  function downloadImage() {
    if (!state.generatedImage) return;

    const link = document.createElement('a');
    link.href = state.generatedImage;
    link.download = `${config.id || 'balloon'}-visualization-${Date.now()}.png`;
    link.click();
  }

  // Download quote as PDF
  async function downloadQuote() {
    if (!state.generatedImage) return;

    // For now, generate a simple HTML-based printable quote
    // In production, you might use a library like jsPDF
    const colorNames = state.selectedColors.map(c => c.name).join(', ');
    const price = state.priceInfo ? `$${state.priceInfo.price}` : 'Quote on request';
    const theme = config.theme || {};
    const primary = theme.primary || '#1A5E63';

    const quoteHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${config.businessName} - Quote</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: ${theme.text || '#333'}; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${primary}; padding-bottom: 20px; }
          .header h1 { color: ${primary}; margin: 0; font-size: 28px; }
          .header p { color: #666; margin-top: 5px; }
          .image-container { text-align: center; margin: 30px 0; }
          .image-container img { max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .details { background: #f9f9f9; padding: 24px; border-radius: 12px; margin: 30px 0; }
          .details h2 { color: ${primary}; margin-top: 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .price { font-size: 32px; color: ${primary}; font-weight: bold; text-align: right; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .disclaimer { font-size: 12px; color: #999; margin-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${config.businessName}</h1>
          <p>${config.tagline || ''}</p>
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
          <p><strong>${config.businessName}</strong></p>
          <p>${(config.contact && config.contact.email) || ''}</p>
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
