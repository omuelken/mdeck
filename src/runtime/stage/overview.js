// Overview -----------------------------------------------------------------
//
// O shows every slide in a grid, in this window only: the presenter
// view opens it in its own slide frame, so the audience never sees it.
// Arrows move the cursor, Enter or a click goes to that slide, O or
// Escape go back to the slide shown. The slides show every step. Room to
// write (ink/Room.jsx) shows as in print: an expanded slide small, with
// what is written around it, and each blank page in a cell after its slide.
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
    }
    this._overview = on;
    this.toggleAttribute('data-overview', on);
    if (on) {
      this._buildOverview();
      this._ovCursor = this._ovCurrent();
    } else {
      this._clearOverviewMarks();
      this._ovList = null;
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

  // What the grid has a cell for: every slide and, after it, each of its
  // blank pages. `el` is what shows there: the slide, the page that shows it
  // expanded (which then hides the slide, `hides`), or the blank page.
  _overviewEntries() {
    if (this._ovList) return this._ovList;
    const list = [];
    this._slides.forEach((slide, i) => {
      const extras = this._extras?.get(slide);
      const room = extras?.room?.hasAttribute('data-room-open') ? extras.room : null;
      list.push({ slide: i, page: null, el: room ?? slide, hides: room ? slide : null });
      (extras?.pages ?? []).forEach((el, n) => list.push({ slide: i, page: el.dataset.page, n: n + 1, el, hides: null }));
    });
    return (this._ovList = list);
  }

  // The cell of what is on the screen: the slide, or its blank page.
  _ovCurrent() {
    const entries = this._overviewEntries();
    const page = this.pageShown ?? null;
    const at = entries.findIndex(entry => entry.slide === this._index && entry.page === page);
    return at >= 0 ? at : Math.max(0, entries.findIndex(entry => entry.slide === this._index));
  }

  _markOverview() {
    const cells = this._ovCells?.children ?? [];
    const current = this._ovCurrent();
    for (let i = 0; i < cells.length; i++) cells[i].toggleAttribute('data-current', i === current);
  }

  _clearOverviewMarks() {
    for (const el of this._ovMarked ?? []) { el.removeAttribute('data-ov-shown'); el.removeAttribute('data-ov-hidden'); }
    this._ovMarked = [];
  }

  /** A slide was expanded or closed (ink/Room.jsx): the overview shows it so. */
  extrasChanged() {
    if (!this._overview) return;
    this._buildOverview();
    this._fit();
    this._showCursor();
  }

  _buildOverview() {
    this._clearOverviewMarks();
    this._ovList = null;
    const entries = this._overviewEntries();
    const current = this._ovCurrent();
    const cells = entries.map((entry, i) => {
      const slide = this._slides[entry.slide];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'ov-cell';
      cell.dataset.i = String(i);
      // The slide's heading; the label names only its layout. A blank page
      // has the slide's number and its own: 3.1 follows slide 3.
      const heading = entry.page ? null : slide.querySelector('h1, h2, h3');
      const title = (heading?.textContent || '').replace(/\s+/g, ' ').trim();
      const number = entry.page ? `${entry.slide + 1}.${entry.n}` : `${entry.slide + 1}`;
      cell.setAttribute('aria-label', `${number}${title ? ` ${title}` : ''}`);
      const caption = document.createElement('span');
      caption.textContent = `${number}  ${title}`;
      cell.appendChild(caption);
      if (i === current) cell.setAttribute('data-current', '');
      if (entry.el !== slide) { entry.el.setAttribute('data-ov-shown', ''); this._ovMarked.push(entry.el); }
      if (entry.hides) { entry.hides.setAttribute('data-ov-hidden', ''); this._ovMarked.push(entry.hides); }
      return cell;
    });
    this._ovCells?.replaceChildren(...cells);
    this._ovCursor = Math.max(0, Math.min(entries.length - 1, this._ovCursor));
  }

  _fitOverview(vw, vh) {
    const entries = this._overviewEntries();
    const { cols, rows, k, gap, label, pad } = this.overviewLayout(entries.length, vw, vh);
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
    entries.forEach(({ el }, i) => {
      const x = (i % cols) * (W + gap), y = Math.floor(i / cols) * (H + label + gap);
      el.style.setProperty('--ov-x', x + 'px');
      el.style.setProperty('--ov-y', y + 'px');
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

  // Goes to what cell `i` shows: a slide, or one of its blank pages.
  _overviewGo(i, reason = 'keyboard') {
    const entry = this._overviewEntries()[i];
    this.overview = false;
    if (!entry) return;
    const pageStep = page => this._getSteps(this._slides[entry.slide])
      .findIndex(elements => elements.some(el => el.classList?.contains('slide-page') && (!page || el.dataset.page === page)));
    if (entry.page) {
      if (entry.slide !== this._index) this._go(entry.slide, reason, pageStep(entry.page));
      else this.showPage(entry.page, reason);
    } else if (entry.slide !== this._index) this._go(entry.slide, reason);
    else if (this.pageShown) {
      // From one of its pages back to the slide itself, with all it has shown.
      this._stepMap.set(this._index, pageStep(null) - 1);
      this._applySteps(this._index);
      this._broadcastState(reason);
    }
  }

  /** A key typed while the overview is open; says whether it did something. */
  overviewKey(key) {
    if (!this._overview) return false;
    const count = this._overviewEntries().length;
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
