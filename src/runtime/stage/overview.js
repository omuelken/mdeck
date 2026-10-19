// Overview -----------------------------------------------------------------
//
// O shows every slide in a grid, in this window only: the presenter
// view opens it in its own slide frame, so the audience never sees it.
// Arrows move the cursor, Enter or a click goes to that slide, O or
// Escape go back to the slide shown. The slides show every step.
// `overviewchange` ({ open }) says when it opens or closes.
export const Overview = (Base) => class extends Base {
  constructor() {
    super();
    // Overview (O): open or not, and the slide its cursor is on.
    this._overview = false;
    this._ovCursor = 0;
  }

  get overview() { return this._overview; }
  set overview(on) {
    on = !!on && this._slides.length > 0;
    if (on === this._overview) return;
    if (on) {
      if (this.inking) this.inking = false;
      this._stopZoomFlight();
      this._hotspot = null;
      if (this._zoom) this.setZoom(null, 'overview', { announce: false });
      this._ovCursor = this._index;
    }
    this._overview = on;
    this.toggleAttribute('data-overview', on);
    if (on) this._buildOverview();
    else {
      this._ovCells?.replaceChildren();
      if (this._canvas) { this._canvas.style.width = this.designWidth + 'px'; this._canvas.style.height = this.designHeight + 'px'; }
    }
    this._fit();
    if (on) this._showCursor();
    else {
      if (this._stageEl) this._stageEl.scrollTop = 0;
      // The badges were placed for the window as it was when the grid opened.
      this._queueHotspots();
    }
    this.dispatchEvent(new CustomEvent('overviewchange', { detail: { open: on }, bubbles: true, composed: true }));
  }

  /** Columns and scale of the grid for `count` slides in a `vw`×`vh` window. */
  overviewLayout(count, vw, vh) {
    const W = this.designWidth, H = this.designHeight;
    const gap = Math.round(W * 0.06);
    // Room under each slide for its number and title, in design pixels.
    const label = Math.round(H * 0.12);
    const pad = Math.max(16, Math.min(48, vw * 0.03));
    const room = (cols) => {
      const rows = Math.ceil(count / cols);
      const k = Math.min((vw - 2 * pad) / (cols * W + (cols - 1) * gap), (vh - 2 * pad) / (rows * (H + label) + (rows - 1) * gap));
      return { cols, rows, k };
    };
    // All slides at once, as large as they can be…
    let best = room(1);
    for (let cols = 2; cols <= count; cols++) { const next = room(cols); if (next.k > best.k) best = next; }
    // …unless they get too small to read: then fewer columns, and scrolling.
    const minWidth = 160;
    if (best.k * W < minWidth) {
      const cols = Math.max(1, Math.min(count, Math.floor((vw - 2 * pad + gap * minWidth / W) / (minWidth + gap * minWidth / W))));
      const rows = Math.ceil(count / cols);
      best = { cols, rows, k: (vw - 2 * pad) / (cols * W + (cols - 1) * gap) };
    }
    return { ...best, gap, label, pad };
  }

  _buildOverview() {
    const cells = this._slides.map((slide, i) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ov-cell';
      cell.dataset.i = String(i);
      // The slide's heading; the label names only its layout.
      const heading = slide.querySelector('h1, h2, h3');
      const title = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
      cell.setAttribute('aria-label', `${i + 1}${title ? ` ${title}` : ''}`);
      const caption = document.createElement('span');
      caption.textContent = `${i + 1}  ${title}`;
      cell.appendChild(caption);
      if (i === this._index) cell.setAttribute('data-current', '');
      return cell;
    });
    this._ovCells?.replaceChildren(...cells);
  }

  _fitOverview(vw, vh) {
    const { cols, rows, k, gap, label, pad } = this.overviewLayout(this._slides.length, vw, vh);
    const W = this.designWidth, H = this.designHeight;
    const width = cols * W + (cols - 1) * gap;
    const height = rows * (H + label) + (rows - 1) * gap;
    this._fitScale = k;
    // Centred across, and down too when it all fits.
    const left = Math.max(pad, (vw - width * k) / 2);
    const top = Math.max(pad, (vh - height * k) / 2);
    this._canvas.style.width = width + 'px';
    this._canvas.style.height = height + 'px';
    this._canvas.style.transform = `translate(${left}px, ${top}px) scale(${k})`;
    this._canvas.style.setProperty('--ov-k', String(1 / k));
    if (this._ovSizer) { this._ovSizer.style.width = '1px'; this._ovSizer.style.height = `${Math.ceil(top * 2 + height * k)}px`; }
    const cells = this._ovCells?.children ?? [];
    this._slides.forEach((slide, i) => {
      const x = (i % cols) * (W + gap), y = Math.floor(i / cols) * (H + label + gap);
      slide.style.setProperty('--ov-x', x + 'px');
      slide.style.setProperty('--ov-y', y + 'px');
      const cell = cells[i];
      if (cell) Object.assign(cell.style, { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' });
    });
    this._ovLayout = { cols };
  }

  _showCursor() {
    const cells = this._ovCells?.children ?? [];
    for (let i = 0; i < cells.length; i++) cells[i].toggleAttribute('data-cursor', i === this._ovCursor);
    cells[this._ovCursor]?.scrollIntoView?.({ block: 'nearest' });
  }

  _overviewGo(i, reason = 'keyboard') {
    this.overview = false;
    if (i !== this._index) this._go(i, reason);
  }

  /** A key typed while the overview is open; says whether it did something. */
  overviewKey(key) {
    if (!this._overview) return false;
    const count = this._slides.length;
    const cols = this._ovLayout?.cols ?? 1;
    const move = to => { this._ovCursor = Math.max(0, Math.min(count - 1, to)); this._showCursor(); };
    if (key === 'ArrowRight' || key === 'PageDown') move(this._ovCursor + 1);
    else if (key === 'ArrowLeft' || key === 'PageUp') move(this._ovCursor - 1);
    else if (key === 'ArrowDown') move(this._ovCursor + cols);
    else if (key === 'ArrowUp') move(this._ovCursor - cols);
    else if (key === 'Home') move(0);
    else if (key === 'End') move(count - 1);
    else if (key === 'Enter' || key === ' ' || key === 'Spacebar') this._overviewGo(this._ovCursor);
    else if (key === 'Escape' || key === 'o' || key === 'O') this.overview = false;
    else return false;
    return true;
  }
};
