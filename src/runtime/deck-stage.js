/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→, PgUp/PgDn, Space, Home/End, number keys.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on idle.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup. While printing, every
 *      step on every slide is revealed and the stage carries the
 *      `data-deck-static` attribute (see "Print mode" below).
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api' | 'reset' | 'sync'
 *   });
 *
 * Print mode — before printing (the browser's `beforeprint`, or an explicit
 * `stage.printing = true` from the PDF renderer) the stage reveals all steps,
 * sets `data-deck-static` on itself and dispatches a `printchange` event with
 * `detail.printing`. The reader's Read mode marks its slides the same way.
 * Interactive slide code that normally waits for its slide or its steps
 * should render its finished state inside `[data-deck-static]`:
 *
 *   const finished = () => !!el.closest('[data-deck-static]');
 *   stage?.addEventListener('printchange', () => render(finished()));
 *
 * Leaving print mode restores each slide's step position.
 *
 * Persistence: none at the deck level. The host app keeps the current slide
 * in its own URL (?slide=) and re-delivers it via location.hash on load, so a
 * bare load with no hash always starts at slide 1.
 *
 * Usage:
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 */

import { iconSvg } from '../core/icons.js'

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const isEmbedded = new URLSearchParams(location.search).has('embedded');

  const pad2 = (n) => String(n).padStart(2, '0');

  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    /* Tap zones for mobile — back/forward thirds like Stories.
       Transparent, no visible UI, don't block the overlay. */
    .tapzones {
      position: fixed;
      inset: 0;
      display: flex;
      z-index: 2147482000;
      pointer-events: none;
    }
    .tapzone {
      flex: 1;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    /* Only activate tap zones on coarse pointers (touch devices). */
    @media (hover: hover) and (pointer: fine) {
      .tapzones { display: none; }
    }

    /* Ink: while drawing, a layer above the tap zones takes all pointer
       input, and the stroke in progress is drawn on .ink-live, which sits in
       the scaled canvas and so uses design pixels. */
    .ink-input {
      position: fixed;
      inset: 0;
      z-index: 2147482100;
      display: none;
      touch-action: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
      cursor: crosshair;
    }
    :host([data-inking]) .ink-input { display: block; }
    :host([data-inking]) .tapzones { display: none !important; }
    :host([data-ink-tool="eraser"]) .ink-input { cursor: cell; }
    .ink-live {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
      z-index: 1;
    }
    .ink-live .fading { transition: opacity 0.8s ease 2.2s; opacity: 0; }
    /* The ink toolbar replaces the overlay while drawing. */
    :host([data-inking]) .overlay { display: none; }
    .btn.draw, .btn.fullscreen { display: none; }
    :host([data-ink-enabled]) .btn.draw { display: inline-flex; }
    :host([data-fullscreen-available]) .btn.fullscreen { display: inline-flex; }
    @media (pointer: coarse) { .overlay .btn { height: 40px; min-width: 40px; } }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 16px; height: 16px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }
    .step-progress { color: rgba(255,255,255,0.55); font-size: 11px; margin: 0 2px; }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that connectedCallback injects
       into <head> (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      ::slotted(*:last-child) {
        break-after: auto;
        page-break-after: auto;
      }
      .overlay, .tapzones, .ink-input, .ink-live { display: none !important; }
    }
  `;

  // Full screen, with Safari's prefixed names (iPad); unavailable on an iPhone.
  function fullscreenAvailable() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }
  // Older Safari (iPad) names the element and the exit differently; a miss
  // here made the button enter full screen again instead of leaving it, and
  // an iPad has no Escape key to get out.
  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
  }
  function toggleFullscreen(element = document.documentElement) {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
      return exit?.call(document);
    }
    const request = element.requestFullscreen || element.webkitRequestFullscreen;
    return request?.call(element);
  }
  /** Calls back with true or false whenever the page enters or leaves full screen; returns a function that stops it. */
  function onFullscreenChange(listener) {
    const handler = () => listener(!!fullscreenElement());
    for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, handler);
    return () => { for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.removeEventListener(name, handler); };
  }
  window.mdeckFullscreen = { available: fullscreenAvailable, element: fullscreenElement, toggle: toggleFullscreen, onChange: onFullscreenChange };

  class DeckStage extends HTMLElement {
    static get observedAttributes() { return ['width', 'height', 'noscale']; }

    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._index = 0;
      this._slides = [];
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._stepMap = new Map();

      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTapBack = this._onTapBack.bind(this);
      this._onTapForward = this._onTapForward.bind(this);
      this._onInkDown = this._onInkDown.bind(this);
      this._onInkMove = this._onInkMove.bind(this);
      this._onInkUp = this._onInkUp.bind(this);
      this.inkTool = { tool: 'pen', color: '#e11d48', size: 6 };
      this.inkFinger = false;
      this.inkRenderer = null;
      this._penSeen = false;
      this._onBeforePrint = () => { this.printing = true; };
      this._onAfterPrint = () => { this.printing = false; };
    }

    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }

    connectedCallback() {
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      window.addEventListener('keydown', this._onKey);
      if (typeof ResizeObserver !== 'undefined') { this._resizeObserver = new ResizeObserver(() => this._fit()); this._resizeObserver.observe(this); }
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
      window.addEventListener('beforeprint', this._onBeforePrint);
      window.addEventListener('afterprint', this._onAfterPrint);
      // Initial collection + layout happens via slotchange, which fires on mount.
    }

    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      this._resizeObserver?.disconnect();
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('beforeprint', this._onBeforePrint);
      window.removeEventListener('afterprint', this._onAfterPrint);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
    }

    attributeChangedCallback() {
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        this._inkLive?.setAttribute('viewBox', `0 0 ${this.designWidth} ${this.designHeight}`);
        this._fit();
        this._syncPrintPageRule();
      }
    }

    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;

      const stage = document.createElement('div');
      stage.className = 'stage';

      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');

      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      const inkLive = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      inkLive.setAttribute('class', 'ink-live');
      inkLive.setAttribute('viewBox', `0 0 ${this.designWidth} ${this.designHeight}`);
      inkLive.setAttribute('preserveAspectRatio', 'none');
      canvas.appendChild(inkLive);
      stage.appendChild(canvas);

      const inkInput = document.createElement('div');
      inkInput.className = 'ink-input export-hidden';
      inkInput.addEventListener('pointerdown', this._onInkDown);
      inkInput.addEventListener('pointermove', this._onInkMove);
      inkInput.addEventListener('pointerup', this._onInkUp);
      inkInput.addEventListener('pointercancel', this._onInkUp);
      // iPad Safari: no scrolling, zooming or callouts while drawing.
      inkInput.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
      this._inkLive = inkLive;

      // Tap zones (mobile): left third = back, right third = forward.
      const tapzones = document.createElement('div');
      tapzones.className = 'tapzones export-hidden';
      tapzones.setAttribute('aria-hidden', 'true');
      tapzones.setAttribute('data-noncommentable', '');
      const tzBack = document.createElement('div');
      tzBack.className = 'tapzone tapzone--back';
      const tzMid = document.createElement('div');
      tzMid.className = 'tapzone tapzone--mid';
      tzMid.style.pointerEvents = 'none';
      const tzFwd = document.createElement('div');
      tzFwd.className = 'tapzone tapzone--fwd';
      tzBack.addEventListener('click', this._onTapBack);
      tzFwd.addEventListener('click', this._onTapForward);
      tapzones.append(tzBack, tzMid, tzFwd);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.setAttribute('data-noncommentable', '');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          ${iconSvg('prev')}
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="step-progress" hidden> · <span class="step-cur">0</span>/<span class="step-total">1</span></span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          ${iconSvg('next')}
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
        <button class="btn draw" type="button" aria-label="Draw on the slide" title="Draw (D)">
          ${iconSvg('pen')}
        </button>
        <button class="btn fullscreen" type="button" aria-label="Full screen" title="Full screen (F)">
          ${iconSvg('fullscreen')}
        </button>
      `;

      overlay.querySelector('.prev').addEventListener('click', () => this.prev('click'));
      overlay.querySelector('.next').addEventListener('click', () => this.next('click'));
      overlay.querySelector('.reset').addEventListener('click', () => this.reset());
      overlay.querySelector('.draw').addEventListener('click', () => { this.inking = !this.inking; });
      const fullscreenButton = overlay.querySelector('.fullscreen');
      fullscreenButton.addEventListener('click', () => toggleFullscreen());
      // The same button leaves full screen, and says so.
      onFullscreenChange(on => {
        fullscreenButton.innerHTML = iconSvg(on ? 'fullscreen-exit' : 'fullscreen');
        fullscreenButton.title = on ? 'Exit full screen (F)' : 'Full screen (F)';
        fullscreenButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      });
      // Only a top-level window can go full screen (an iPhone cannot at all).
      if (window.top === window && fullscreenAvailable()) this.setAttribute('data-fullscreen-available', '');

      this._root.append(style, stage, tapzones, inkInput, overlay);
      this._canvas = canvas;
      this._slot = slot;
      this._overlay = overlay;
      this._countEl        = overlay.querySelector('.current');
      this._totalEl        = overlay.querySelector('.total');
      this._stepProgressEl = overlay.querySelector('.step-progress');
      this._stepCurEl      = overlay.querySelector('.step-cur');
      this._stepTotalEl    = overlay.querySelector('.step-total');
      this._overlay        = overlay;
      if (this._labels) this.setLabels(this._labels);
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. Inject/update a single <head> style tag so the print
     *  sheet matches the design size and Save-as-PDF yields one slide per
     *  page with no margins. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        document.head.appendChild(tag);
      }
      tag.textContent =
        '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' +
        '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' +
        '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }';
    }

    _onSlotChange() {
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({ showOverlay: false, broadcast: true, reason: 'init' });
      this._fit();
    }

    _collectSlides() {
      const assigned = this._slot.assignedElements({ flatten: true });
      this._slides = assigned.filter((el) => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });

      this._slides.forEach((slide, i) => {
        const n = i + 1;
        // Determine a label for comment flow: prefer explicit data-label,
        // then an existing data-screen-label, then first heading, else "Slide".
        let label = slide.getAttribute('data-label');
        if (!label) {
          const existing = slide.getAttribute('data-screen-label');
          if (existing) {
            // Strip any leading number the author may have included.
            label = existing.replace(/^\s*\d+\s*/, '').trim() || existing;
          }
        }
        if (!label) {
          const h = slide.querySelector('h1, h2, h3, [data-title]');
          if (h) label = (h.textContent || '').trim().slice(0, 40);
        }
        if (!label) label = 'Slide';
        slide.setAttribute('data-screen-label', `${pad2(n)} ${label}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }

        slide.setAttribute('data-deck-slide', String(i));
      });

      if (this._totalEl) this._totalEl.textContent = String(this._slides.length || 1);
      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
    }

    _loadNotes() {
      const tag = document.getElementById('speaker-notes');
      if (!tag) { this._notes = []; return; }
      try {
        const parsed = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(parsed)) this._notes = parsed;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
        this._notes = [];
      }
    }

    _restoreIndex() {
      const named = this._slides.findIndex(s => '#' + encodeURIComponent(s.dataset.slideId) === location.hash);
      if (named >= 0) { this._index = named; return; }
      // The host's ?slide= param is delivered as a #<int> hash (1-indexed) on
      // the iframe src. No hash → slide 1; the deck itself keeps no position
      // state across loads.
      const h = (location.hash || '').match(/^#(\d+)$/);
      if (h) {
        const n = parseInt(h[1], 10) - 1;
        if (n >= 0 && n < this._slides.length) this._index = n;
      }
    }

    _applyIndex({ showOverlay = true, broadcast = true, reason = 'init', step = -1 } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      // Keep the iframe's own hash in sync so an in-iframe location.reload()
      // (reload banner path in viewer-handle.ts) lands on the current slide,
      // not the stale deep-link hash from initial load.
      try { history.replaceState(null, '', '#' + (this._slides[curr].dataset.slideId || (curr + 1))); } catch (e) {}
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');
        else s.removeAttribute('data-deck-active');
      });
      this._stepMap.delete(curr);
      if (step >= 0) this._stepMap.set(curr, step);
      this._applySteps(curr);
      if (this._countEl) this._countEl.textContent = String(curr + 1);

      if (broadcast) {
        // (1) Legacy: postMessage bridge for presenter/speaker-note renderers.
        const note = this._notes[curr] ?? null;
        try { window.postMessage({ slideIndexChanged: curr, note, reason }, '*'); } catch (e) {}
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ slideIndexChanged: curr, note, reason }, '*');
          }
        } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? (this._slides[prev] || null) : null,
          reason: reason, // 'init' | 'keyboard' | 'click' | 'tap' | 'api' | 'reset' | 'sync'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true,
        }));
      }

      this._prevIndex = curr;
      if (broadcast) this._broadcastState(reason);
      if (showOverlay) this._flashOverlay();
    }

    get state() {
      return { index: this._index, slideId: this._slides[this._index]?.dataset.slideId,
        step: this._stepMap.get(this._index) ?? -1 };
    }

    _broadcastState(reason) {
      const message = { deckStateChanged: this.state, reason };
      window.postMessage(message, '*');
      if (window.parent !== window) window.parent.postMessage(message, '*');
      this.dispatchEvent(new CustomEvent('statechange', { detail: { ...this.state, reason } }));
    }

    setState(state) {
      if (!state || !Number.isInteger(state.index) || !Number.isInteger(state.step)) return;
      const byId = state.slideId ? this._slides.findIndex(s => s.dataset.slideId === state.slideId) : -1;
      const index = byId >= 0 ? byId : state.index;
      if (index < 0 || index >= this._slides.length) return;
      const max = this._getSteps(this._slides[index]).length - 1;
      const step = Math.max(-1, Math.min(max, state.step));
      if (index === this._index) {
        if (step === this.state.step) return;
        this._stepMap.set(index, step);
        this._applySteps(index);
        this._broadcastState('sync');
      } else {
        this._index = index;
        this._applyIndex({ reason: 'sync', step });
      }
    }

    _flashOverlay() {
      if (!this._overlay || isEmbedded) return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }

    _fit() {
      if (!this._canvas) return;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        return;
      }
      // Fit the host element, which is the viewport when the stage is
      // full-screen and a panel when it is embedded in another layout.
      const rect = this.getBoundingClientRect();
      const vw = rect.width || window.innerWidth;
      const vh = rect.height || window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      this._canvas.style.transform = `scale(${s})`;
    }

    _onResize() { this._fit(); }

    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle.
      this._flashOverlay();
    }

    _onTapBack(e) {
      e.preventDefault();
      this.prev('tap');
    }

    _onTapForward(e) {
      e.preventDefault();
      this.next('tap');
    }

    _onKey(e) {
      // Ignore when the user is typing.
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      let handled = true;

      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this.next('keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this.prev('keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'i' || key === 'I') {
        // Show or hide the saved ink.
        e.preventDefault();
        this.toggleAttribute('data-ink-hidden');
      } else if ((key === 'f' || key === 'F') && window.top === window && fullscreenAvailable()) {
        toggleFullscreen();
      } else if (key === 'r' || key === 'R') {
        this.reset();
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }

      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }

    _go(i, reason = 'api') {
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({ showOverlay: true, broadcast: true, reason });
    }

    // Step reveal helpers ---------------------------------------------------

    _getSteps(slide) {
      if (!slide) return [];
      // Multiple and nested reveal blocks follow document order.
      return [...slide.querySelectorAll('[data-step]')];
    }

    _applySteps(slideIndex) {
      const slide = this._slides[slideIndex];
      if (!slide) return;
      const steps = this._getSteps(slide);
      const curr  = this._printing ? steps.length - 1 : (this._stepMap.get(slideIndex) ?? -1);
      steps.forEach((el, i) =>
        i <= curr ? el.setAttribute('data-step-visible', '') : el.removeAttribute('data-step-visible')
      );
      this._updateStepCount(slideIndex);
    }

    _updateStepCount(slideIndex) {
      if (!this._stepProgressEl) return;
      const steps = this._getSteps(this._slides[slideIndex]);
      if (steps.length === 0) {
        this._stepProgressEl.hidden = true;
        return;
      }
      const curr = this._stepMap.get(slideIndex) ?? -1;
      this._stepCurEl.textContent  = String(curr + 1);
      this._stepTotalEl.textContent = String(steps.length);
      this._stepProgressEl.hidden  = false;
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() { return this._index; }
    /** Total slide count. */
    get length() { return this._slides.length; }
    /** Words on the control bar, in the deck's language:
     *  { controls, previous, next, reset, resetHint }. */
    setLabels(labels = {}) {
      this._labels = labels;
      const overlay = this._overlay;
      if (!overlay) return;
      if (labels.controls) overlay.setAttribute('aria-label', labels.controls);
      if (labels.previous) overlay.querySelector('.prev').setAttribute('aria-label', labels.previous);
      if (labels.next) overlay.querySelector('.next').setAttribute('aria-label', labels.next);
      const reset = overlay.querySelector('.reset');
      if (labels.resetHint) reset.setAttribute('aria-label', labels.resetHint);
      if (labels.reset) reset.firstChild.textContent = labels.reset;
      if (labels.resetHint) reset.title = `${labels.resetHint} (R)`;
    }
    // Ink input ---------------------------------------------------------------
    //
    // While `inking` is on, pen, finger and mouse input draws on the current
    // slide instead of changing slides. Finished strokes are announced as
    // `inkstroke` events ({ slideId, tool, color, size, points }), in design
    // pixels with pressure; the marker's as `inkmarker`, which also fades on
    // its own; the eraser sends `inkerase` ({ slideId, point, radius }) while
    // it moves, all with the same `gesture` number for one stroke of the
    // eraser. `inkTool` is { tool: 'pen' | 'highlighter' | 'marker' |
    // 'eraser', color, size }. Once a pen was used, fingers no longer draw
    // (palm rejection) unless `inkFinger` is set. `inkRenderer(stroke)` may
    // return an SVG path for the stroke in progress. While a stroke is drawn,
    // `inkprogress` repeats it as it grows; `key` ties it to its end event.

    get inking() { return this.hasAttribute('data-inking'); }
    set inking(on) {
      this.toggleAttribute('data-inking', !!on);
      if (!on) this._endInk(null);
      this.dispatchEvent(new CustomEvent('inkmode', { detail: { inking: !!on }, bubbles: true, composed: true }));
    }

    _inkSlideId() { return this._slides[this._index]?.dataset.slideId ?? null; }

    _inkPoint(e) {
      const rect = this._canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * this.designWidth / rect.width;
      const y = (e.clientY - rect.top) * this.designHeight / rect.height;
      const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(pressure * 100) / 100];
    }

    _acceptsPointer(e) {
      if (e.pointerType === 'mouse') return e.button === 0;
      if (e.pointerType === 'pen') { this._penSeen = true; return true; }
      return !this._penSeen || this.inkFinger;
    }

    _drawLive(path, points, tool) {
      const stroke = { tool: tool.tool === 'highlighter' ? 'highlighter' : 'pen', size: tool.size, points };
      const d = this.inkRenderer ? this.inkRenderer(stroke)
        : 'M' + points.map(p => p[0] + ' ' + p[1]).join(' L');
      path.setAttribute('d', d);
    }

    _onInkDown(e) {
      if (this._inkDrawing || !this._acceptsPointer(e)) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      const tool = { ...this.inkTool };
      const point = this._inkPoint(e);
      this._inkGesture = (this._inkGesture || 0) + 1;
      this._inkDrawing = { pointerId: e.pointerId, tool, points: [point], slideId: this._inkSlideId(), gesture: this._inkGesture };
      if (tool.tool === 'eraser') { this._erase(point); return; }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._styleLive(path, tool);
      this._inkLive.appendChild(path);
      this._inkDrawing.path = path;
      this._inkDrawing.key = `${this._inkGesture}`;
      this._drawLive(path, this._inkDrawing.points, tool);
      this._inkProgress(this._inkDrawing);
    }

    _styleLive(path, { tool, color, size }) {
      const renderer = !!this.inkRenderer;
      // "accent" is the theme's accent colour (inkPaint in core/ink.js).
      path.style[renderer ? 'fill' : 'stroke'] = color === 'accent' ? 'var(--accent, #e11d48)' : color;
      if (!renderer) { path.setAttribute('fill', 'none'); path.setAttribute('stroke-width', size); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); }
      path.setAttribute(renderer ? 'fill-opacity' : 'stroke-opacity', tool === 'highlighter' ? '0.35' : '1');
    }

    // Announces the stroke in progress (`inkprogress`, the same points array
    // as it grows), so other windows can show it while it is drawn.
    _inkProgress(drawing) {
      const { tool, color, size } = drawing.tool;
      this.dispatchEvent(new CustomEvent('inkprogress', { detail: { key: drawing.key, slideId: drawing.slideId, tool, color, size, points: drawing.points }, bubbles: true, composed: true }));
    }

    _onInkMove(e) {
      const drawing = this._inkDrawing;
      if (!drawing || e.pointerId !== drawing.pointerId) return;
      e.preventDefault();
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of events.length ? events : [e]) drawing.points.push(this._inkPoint(ev));
      if (drawing.tool.tool === 'eraser') this._erase(drawing.points[drawing.points.length - 1]);
      else { this._drawLive(drawing.path, drawing.points, drawing.tool); this._inkProgress(drawing); }
    }

    _onInkUp(e) {
      const drawing = this._inkDrawing;
      if (!drawing || e.pointerId !== drawing.pointerId) return;
      this._endInk(drawing);
    }

    _endInk(drawing) {
      this._inkDrawing = null;
      if (!drawing || drawing.tool.tool === 'eraser' || !drawing.slideId) { drawing?.path?.remove(); return; }
      const { tool, color, size } = drawing.tool;
      const detail = { key: drawing.key, slideId: drawing.slideId, tool: tool === 'marker' ? 'pen' : tool, color, size, points: drawing.points };
      if (tool === 'marker') {
        // Never saved: fades where it was drawn.
        drawing.path.classList.add('fading');
        setTimeout(() => drawing.path.remove(), 3200);
        this.dispatchEvent(new CustomEvent('inkmarker', { detail, bubbles: true, composed: true }));
        return;
      }
      this.dispatchEvent(new CustomEvent('inkstroke', { detail, bubbles: true, composed: true }));
      // The saved layer draws the stroke from now on; keep this one a moment
      // longer so nothing flickers.
      const path = drawing.path;
      requestAnimationFrame(() => requestAnimationFrame(() => path.remove()));
    }

    _erase(point) {
      const slideId = this._inkDrawing?.slideId ?? this._inkSlideId();
      if (!slideId) return;
      this.dispatchEvent(new CustomEvent('inkerase', { detail: { slideId, point, radius: 14, gesture: this._inkDrawing?.gesture ?? 0 }, bubbles: true, composed: true }));
    }

    /**
     * Strokes being drawn in another window: `liveStroke(key, stroke)` shows
     * or updates one ({ slideId, tool, color, size, points }), only while
     * this window shows that slide; `endLiveStroke(key, { fade })` removes it,
     * fading like the marker, or once the saved layer draws it.
     */
    liveStroke(key, { slideId, tool = 'pen', color = '#e11d48', size = 6, points }) {
      if (!this._inkLive || !points?.length) return;
      this._remoteInk ??= new Map();
      let path = this._remoteInk.get(key);
      if (slideId && slideId !== this._inkSlideId()) { path?.remove(); this._remoteInk.delete(key); return; }
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._styleLive(path, { tool, color, size });
        this._inkLive.appendChild(path);
        this._remoteInk.set(key, path);
      }
      this._drawLive(path, points, { tool, size });
    }

    endLiveStroke(key, { fade = false } = {}) {
      const path = this._remoteInk?.get(key);
      if (!path) return;
      this._remoteInk.delete(key);
      if (fade) { requestAnimationFrame(() => path.classList.add('fading')); setTimeout(() => path.remove(), 3200); }
      else requestAnimationFrame(() => requestAnimationFrame(() => path.remove()));
    }

    /** True while the deck is laid out for print or PDF. */
    get printing() { return !!this._printing; }
    /** Enter or leave print mode: reveal every step and tell slide code to show its final state. */
    set printing(on) {
      on = !!on;
      if (on === this.printing) return;
      this._printing = on;
      this.toggleAttribute('data-deck-static', on);
      this._slides.forEach((_, i) => this._applySteps(i));
      this.dispatchEvent(new CustomEvent('printchange', {
        detail: { printing: on },
        bubbles: true,
        composed: true,
      }));
    }
    /** Programmatically navigate to a specific slide (no step checks). */
    goTo(i) { this._go(i, 'api'); }
    /** Advance: reveals next step if the current slide has unrevealed steps, else goes to next slide. */
    next(reason = 'api') {
      const steps = this._getSteps(this._slides[this._index]);
      const curr  = this._stepMap.get(this._index) ?? -1;
      if (steps.length > 0 && curr < steps.length - 1) {
        this._stepMap.set(this._index, curr + 1);
        this._applySteps(this._index);
        this._broadcastState(reason);
        this._flashOverlay();
        return;
      }
      this._go(this._index + 1, reason);
    }
    /** Go back: hides last revealed step if any, else goes to previous slide. */
    prev(reason = 'api') {
      const steps = this._getSteps(this._slides[this._index]);
      const curr  = this._stepMap.get(this._index) ?? -1;
      if (steps.length > 0 && curr >= 0) {
        this._stepMap.set(this._index, curr - 1);
        this._applySteps(this._index);
        this._broadcastState(reason);
        this._flashOverlay();
        return;
      }
      this._go(this._index - 1, reason);
    }
    /** Reset to first slide and clear all step state. */
    reset() {
      this._stepMap.clear();
      // Moving to the first slide reports the new position itself; report it
      // once more only when the deck was already there, for the cleared steps.
      // Two reports for one reset arrived in other windows one after the
      // other, and the late one could undo a change made in between.
      if (this._index !== 0) { this._go(0, 'reset'); return; }
      this._applySteps(0);
      this._broadcastState('reset');
    }
  }

  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
