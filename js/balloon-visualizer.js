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
    isRevealed: false,
    focusMode: false
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

  // Inject the visualizer's own CSS (balloon loader, reduced-motion fallbacks)
  // so the component stays self-contained on any tenant page.
  function ensureVisualizerStyles() {
    if (document.getElementById('bv-styles')) return;
    const style = document.createElement('style');
    style.id = 'bv-styles';
    style.textContent = `
      .bv-balloon {
        position: absolute;
        top: 100%;
        border-radius: 50% 50% 48% 52% / 58% 58% 42% 42%;
        background: radial-gradient(circle at 32% 26%, rgba(255,255,255,0.85), rgba(255,255,255,0) 42%), var(--bv-color, #ccc);
        animation: bv-rise linear infinite;
        will-change: transform;
        opacity: 0.9;
      }
      .bv-balloon::after {
        content: '';
        position: absolute;
        top: 99%;
        left: 50%;
        width: 1px;
        height: 40%;
        background: rgba(0,0,0,0.18);
        transform: translateX(-50%);
      }
      @keyframes bv-rise {
        from { transform: translateY(0); }
        to { transform: translateY(-120vh); }
      }
      .bv-fade { transition: opacity 0.45s ease; }
      @media (prefers-reduced-motion: reduce) {
        .bv-balloon {
          top: var(--bv-top, 50%);
          animation: bv-breathe 5s ease-in-out infinite;
        }
        @keyframes bv-breathe {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
      }
    `;
    document.head.appendChild(style);
  }

  // WCAG relative luminance of a #rrggbb / #rgb color (0 = black, 1 = white).
  function relLuminance(hex) {
    const raw = String(hex || '').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
    const [r, g, b] = [0, 2, 4]
      .map(i => parseInt(full.substr(i, 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Selected-swatch ring: tenant primary, unless the tenant's primary is too
  // pale to read against the white card — then a neutral dark.
  function swatchRingColor() {
    const primary = (config && config.theme && config.theme.primary) || '#1A5E63';
    return relLuminance(primary) > 0.6 ? '#374151' : primary;
  }

  // Mirror of lib/generate-core.js pickOutputSize: the loader (and the locked
  // preview) pre-size to the aspect ratio the server will return, so the
  // finished render swaps in without any layout shift.
  // Sized via a measured pixel height, NOT the aspect-ratio property — that
  // property transfers a min-height into a min-width and blows narrow grid
  // columns out of the viewport. The floor keeps the lead-gate form from
  // needing to scroll on phones. Call only while the element is visible.
  function sizeToPredictedAspect(el) {
    const w = el.clientWidth;
    if (!w) return;
    el.style.height = `${Math.max(Math.round(w / predictedAspect()), 440)}px`;
  }

  const OUTPUT_RATIOS = [1536 / 1024, 1, 1024 / 1536];
  function predictedAspect() {
    const w = Number(state.uploadedWidth);
    const h = Number(state.uploadedHeight);
    if (!w || !h) return 1;
    const src = w / h;
    return OUTPUT_RATIOS.reduce((best, r) =>
      Math.abs(Math.log(src / r)) < Math.abs(Math.log(src / best)) ? r : best
    );
  }

  // "Focus mode": once a generation starts, the render is the hero — the
  // controls column collapses into the compact summary strip in the preview
  // header, and the preview panel takes the full container width.
  function enterFocusMode() {
    state.focusMode = true;
    elements.vizGrid.classList.remove('md:grid-cols-2');
    elements.controlsPanel.classList.add('hidden');
    elements.controlsSummary.classList.remove('hidden');
    elements.controlsSummary.classList.add('flex');
    // After the first generation the preview stays above the controls on
    // mobile, so expanding "Change options" reads as an accordion below it.
    elements.previewPanel.classList.add('order-first', 'md:order-none');
    updateControlsSummary();
  }

  function exitFocusMode() {
    state.focusMode = false;
    elements.vizGrid.classList.add('md:grid-cols-2');
    elements.controlsPanel.classList.remove('hidden');
    elements.controlsSummary.classList.add('hidden');
    elements.controlsSummary.classList.remove('flex');
  }

  function updateControlsSummary() {
    if (state.uploadedImage) elements.summaryThumb.src = state.uploadedImage;
    elements.summaryColors.innerHTML = state.selectedColors.map(c => `
      <span class="w-4 h-4 rounded-full border-2 border-white shadow-sm inline-block" style="background-color: ${c.hex}"></span>
    `).join('');
    elements.summaryStyle.textContent = state.selectedStyle ? state.selectedStyle.name : '';
  }

  // Build the loader scene: balloons in the user's selected colors drifting
  // up through the stage. Deterministic pseudo-random placement (no
  // Math.random needed) so it looks scattered but renders identically.
  function buildLoaderScene() {
    const colors = state.selectedColors.length
      ? state.selectedColors.map(c => c.hex)
      : ['#FFD1DC', '#ADD8E6', '#FFFACD'];
    const BALLOONS = 9;
    let html = '';
    for (let i = 0; i < BALLOONS; i++) {
      const left = (i * 137 + 23) % 92;          // golden-angle spread, 0–92%
      const size = 26 + ((i * 53) % 40);          // 26–65px
      const duration = 7 + (i % 5) * 1.7;         // 7–13.8s
      const delay = -((i * 2.3) % duration);      // negative: field starts full
      const rmTop = 12 + ((i * 61) % 70);         // reduced-motion resting spot
      html += `<span class="bv-balloon" style="
        left: ${left}%;
        width: ${size}px;
        height: ${Math.round(size * 1.16)}px;
        --bv-color: ${colors[i % colors.length]};
        --bv-top: ${rmTop}%;
        animation-duration: ${duration}s;
        animation-delay: ${delay.toFixed(1)}s;
      "></span>`;
    }
    elements.loadingBalloons.innerHTML = html;
    sizeToPredictedAspect(elements.loadingStage);
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

    ensureVisualizerStyles();

    container.innerHTML = `
      <div id="viz-grid" class="grid md:grid-cols-2 gap-6">
        <!-- Left Panel: Controls -->
        <div id="controls-panel" class="space-y-4">
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
        <div id="preview-panel" class="bg-white rounded-2xl p-4 shadow-sm flex flex-col">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h3 class="font-semibold text-dark text-sm shrink-0">AI Preview</h3>
            <!-- Compact controls summary (shown while the render is the hero) -->
            <div id="controls-summary" class="hidden items-center gap-2 min-w-0">
              <img id="summary-thumb" class="w-8 h-8 rounded-lg object-cover shrink-0" alt="Your photo">
              <div id="summary-colors" class="flex -space-x-1.5 shrink-0"></div>
              <span id="summary-style" class="text-xs text-gray-500 truncate hidden sm:inline"></span>
              <button id="edit-options-btn" type="button"
                class="shrink-0 text-xs font-semibold text-teal border border-current/30 rounded-full px-3 py-1.5 hover:bg-teal hover:text-white transition-colors">
                Change options
              </button>
            </div>
          </div>

          <!-- Loading State: floating balloons in the user's colors + rotating copy -->
          <div id="loading-state" class="hidden">
            <div id="loading-stage" class="relative overflow-hidden rounded-xl w-full" style="background: linear-gradient(180deg, #f7fafa 0%, #e9f0f0 100%);">
              <div id="loading-balloons" class="absolute inset-0" aria-hidden="true"></div>
              <div class="absolute inset-0 flex items-center justify-center p-6">
                <div class="bg-white/75 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-sm w-full max-w-xs text-center">
                  <p id="loading-text" class="text-sm font-medium text-gray-600 mb-3 bv-fade">Inflating the balloons&hellip;</p>
                  <div class="h-1.5 bg-black/10 rounded-full overflow-hidden" role="progressbar" aria-label="Generating your visualization">
                    <div id="loading-bar" class="h-full rounded-full" style="width: 0%; background: var(--gold); transition: width 0.4s ease;"></div>
                  </div>
                </div>
              </div>
            </div>
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
            <div id="result-media" class="relative mb-3 overflow-hidden rounded-xl">
              <img id="result-image" class="w-full rounded-xl transition-all duration-700">
              <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold tracking-wider text-teal">
                AI GENERATED
              </div>

              <!-- Lead Gate: centered modal over the fully blurred render -->
              <div id="lead-gate" class="hidden absolute inset-0 z-10">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="absolute inset-0 overflow-y-auto flex p-4 sm:p-6">
                  <form id="lead-form" class="m-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-7 w-full max-w-md">
                    <p class="font-semibold text-dark text-base mb-1">Your design is ready!</p>
                    <p class="text-xs text-gray-500 mb-4">Tell us where to send your free estimate and we'll reveal it instantly.</p>
                    <div id="lead-fields" class="space-y-2.5"></div>
                    <p id="lead-error" class="hidden text-xs text-red-500 mt-2">Please fill in your name, email, and phone.</p>
                    <button type="submit" class="w-full btn-primary py-2.5 rounded-lg font-semibold text-sm mt-4">Reveal My Design</button>
                  </form>
                </div>
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
              <button id="start-over-btn" type="button" class="w-full mt-2 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-teal transition-colors flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Create Another Design
              </button>
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
      vizGrid: document.getElementById('viz-grid'),
      controlsPanel: document.getElementById('controls-panel'),
      previewPanel: document.getElementById('preview-panel'),
      controlsSummary: document.getElementById('controls-summary'),
      summaryThumb: document.getElementById('summary-thumb'),
      summaryColors: document.getElementById('summary-colors'),
      summaryStyle: document.getElementById('summary-style'),
      editOptionsBtn: document.getElementById('edit-options-btn'),
      loadingStage: document.getElementById('loading-stage'),
      loadingBalloons: document.getElementById('loading-balloons'),
      loadingBar: document.getElementById('loading-bar'),
      resultMedia: document.getElementById('result-media'),
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
      startOverBtn: document.getElementById('start-over-btn'),
      downloadImageBtn: document.getElementById('download-image-btn'),
      downloadQuoteBtn: document.getElementById('download-quote-btn'),
      retryBtn: document.getElementById('retry-btn')
    };

    renderColorGrid();
    renderStyleSelector();
    renderLeadFields();
  }

  // Render color selection grid from tenant config. Pale swatches get a dark
  // checkmark + a subtle inset edge so selection stays visible on any palette.
  function renderColorGrid() {
    elements.colorGrid.innerHTML = (config.colors || []).map(color => {
      const isLight = relLuminance(color.hex) > 0.5;
      const check = isLight ? '#1f2937' : '#ffffff';
      const halo = isLight ? '0 1px 2px rgba(255,255,255,0.8)' : '0 1px 2px rgba(0,0,0,0.5)';
      const edge = isLight ? 'box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);' : '';
      return `
      <button
        class="color-btn w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform relative"
        style="background-color: ${color.hex}; ${edge}"
        data-color="${color.name}"
        data-hex="${color.hex}"
        title="${color.name}">
        <span class="check-mark hidden absolute inset-0 flex items-center justify-center text-base font-bold" style="color: ${check}; text-shadow: ${halo}">✓</span>
      </button>
    `;
    }).join('');
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

    // Focus mode: expand the collapsed controls back out
    elements.editOptionsBtn.addEventListener('click', () => {
      exitFocusMode();
      elements.controlsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // "Create Another Design": same escape hatch, discoverable at the end of
    // the result flow — selections are kept so the user can tweak and rerun.
    elements.startOverBtn.addEventListener('click', () => {
      exitFocusMode();
      elements.controlsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
      btn.classList.remove('ring-2', 'ring-offset-2');
      btn.style.removeProperty('--tw-ring-color');
      checkMark.classList.add('hidden');
    } else if (state.selectedColors.length < 3) {
      // Select
      state.selectedColors.push({ name: colorName, hex: colorHex });
      btn.classList.add('ring-2', 'ring-offset-2');
      btn.style.setProperty('--tw-ring-color', swatchRingColor());
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
    enterFocusMode();
    showState('loading'); // before buildLoaderScene: sizing needs a visible stage
    buildLoaderScene();
    elements.generateBtn.disabled = true;

    // Rotating status copy, personalized with the user's actual selections
    const colorNames = state.selectedColors.map(c => c.name);
    const loadingMessages = [
      'Inflating the balloons…',
      colorNames.length ? `Matching ${colorNames.join(', ')}…` : 'Matching your colors…',
      state.selectedStyle ? `Styling your ${state.selectedStyle.name}…` : 'Styling your design…',
      'Adding the finishing touches…'
    ];
    elements.loadingText.textContent = loadingMessages[0];
    elements.loadingText.style.opacity = '1';
    let msgIndex = 0;
    const loadingInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % loadingMessages.length;
      elements.loadingText.style.opacity = '0';
      setTimeout(() => {
        elements.loadingText.textContent = loadingMessages[msgIndex];
        elements.loadingText.style.opacity = '1';
      }, 450);
    }, 7000);

    // Eased "determinate-feeling" progress, capped at 90% until the render
    // actually returns (renders run ~30–115s; ~63% of the cap at 35s).
    const startedAt = Date.now();
    elements.loadingBar.style.width = '0%';
    const progressInterval = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      const pct = 90 * (1 - Math.exp(-t / 35));
      elements.loadingBar.style.width = `${pct.toFixed(1)}%`;
    }, 300);

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

      elements.loadingBar.style.width = '100%';

      showState('result'); // before lock/reveal: locked sizing needs a visible box
      if (config.leadGate && config.leadGate.enabled && !state.isRevealed) {
        lockResult();
      } else {
        revealResult();
      }

    } catch (error) {
      console.error('Generation error:', error);
      elements.errorMessage.textContent = error.message;
      exitFocusMode(); // bring the controls back so the user can adjust
      showState('error');
    } finally {
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
      state.isLoading = false;
      updateGenerateButton();
    }
  }

  // Lead gate: the whole preview blurs edge-to-edge behind a centered modal.
  // While locked, the media box keeps the loader's predicted aspect ratio and
  // the blurred render cover-fills it — no strips, no seams, no layout shift.
  function lockResult() {
    sizeToPredictedAspect(elements.resultMedia);
    elements.resultImage.classList.add('absolute', 'inset-0', 'h-full', 'object-cover', 'blur-xl', 'scale-110');
    elements.leadGate.classList.remove('hidden');
    elements.quotePanel.classList.add('hidden');
  }

  function revealResult() {
    elements.resultMedia.style.removeProperty('height');
    elements.resultImage.classList.remove('absolute', 'inset-0', 'h-full', 'object-cover', 'blur-xl', 'scale-110');
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

  // Download image. Data URLs can exceed iOS Safari's tolerance for anchor
  // downloads — convert to a blob URL first, fall back to the raw data URL.
  async function downloadImage() {
    if (!state.generatedImage) return;

    const filename = `${config.id || 'balloon'}-visualization-${Date.now()}.png`;
    let href = state.generatedImage;
    let blobUrl = null;
    try {
      const blob = await (await fetch(state.generatedImage)).blob();
      blobUrl = URL.createObjectURL(blob);
      href = blobUrl;
    } catch (e) {
      // fetch of a data URL failed (very old browser) — use it directly
    }

    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }

  // Download quote as PDF.
  // The quote renders into a Blob URL opened in a new tab — never
  // window.open('')+document.write, which returns null under popup blockers
  // and breaks document lifecycle on iOS Safari. Desktop (fine pointer)
  // auto-opens the print dialog; touch devices get an explicit
  // "Print / Save as PDF" button that routes through the share sheet.
  function downloadQuote() {
    if (!state.generatedImage) return;

    const colorNames = state.selectedColors.map(c => c.name).join(', ');
    const price = state.priceInfo ? `$${state.priceInfo.price}` : 'Quote on request';
    const theme = config.theme || {};
    const primary = theme.primary || '#1A5E63';

    const quoteHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.businessName} - Quote</title>
        <style>
          .quote-toolbar { position: sticky; top: 0; z-index: 10; text-align: center; padding: 12px; background: ${primary}; margin: -40px -40px 24px; }
          .quote-toolbar button { background: white; color: ${primary}; border: none; font-size: 15px; font-weight: bold; padding: 10px 28px; border-radius: 999px; cursor: pointer; }
          @media print {
            .quote-toolbar { display: none; }
            /* Keep the render on one page: cap its height to what fits under
               the header and never let a page break slice through it. */
            .image-container { break-inside: avoid; page-break-inside: avoid; margin: 16px 0; }
            .image-container img { max-height: 6.8in; width: auto; max-width: 100%; box-shadow: none; }
            .details, .footer { break-inside: avoid; page-break-inside: avoid; }
          }
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
        <div class="quote-toolbar">
          <button onclick="window.print()">Print / Save as PDF</button>
        </div>
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
        <script>
          // Auto-print only on precise-pointer devices; on touch devices the
          // toolbar button drives print/save via the OS share sheet.
          window.addEventListener('load', function () {
            if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
              setTimeout(function () { window.print(); }, 600);
            }
          });
        <\/script>
      </body>
      </html>
    `;

    const blob = new Blob([quoteHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Popup contexts that block window.open still honor anchor navigation
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Public API
  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', BalloonVisualizer.init);
