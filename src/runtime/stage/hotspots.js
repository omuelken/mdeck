import { findHotspots, hotspotMode } from '../hotspots.js';
import { ZOOM_MAX } from './zoom.js';

// Hotspots ----------------------------------------------------------------
//
// The parts of the slide shown that 1–9 zoom to (hotspots.js finds them).
// Hotspots are off unless the deck (`data-hotspots` on the stage) or the
// slide (`data-hotspots` on its section) turns them on with 'auto' or
// 'marked', or the presenter's switch (`hotspotsForced`) does. The same
// number again, 0, Escape, a tap on the slide or any step or slide
// change shows the whole slide again. Zooms to and from a hotspot fly
// (zoom/camera.js), and other windows fly the same way: their
// `zoomchange` carries `fly: true` and the view it lands on.
export const Hotspots = (Base) => class extends Base {
  constructor() {
    super();
    // Hotspots of the slide shown, the one zoomed to (1-based) and the
    // presenter's switch (true, false, or null for the deck's setting).
    this._hotspots = [];
    this._hotspot = null;
    this._hotspotsForced = null;
    this._hotspotRaf = 0;
    this._queueHotspots = this._queueHotspots.bind(this);
  }

  get hotspotsForced() { return this._hotspotsForced; }
  set hotspotsForced(value) {
    this._hotspotsForced = value === true || value === false ? value : null;
    if (this.hotspotMode === 'off' && this._hotspot) this.wholeSlide();
    this._refreshHotspots();
  }

  /** 'off', 'auto' or 'marked', for the slide shown. */
  get hotspotMode() {
    return hotspotMode({ slide: this._slides[this._index]?.getAttribute?.('data-hotspots'), deck: this.getAttribute('data-hotspots'), forced: this._hotspotsForced });
  }

  /** The current slide's hotspots: [{ rect, zoom }], in design pixels. */
  get hotspots() { return this._hotspots.map(({ rect, zoom }) => ({ rect: { ...rect }, zoom: { ...zoom } })); }

  /** The hotspot zoomed to (1-based), or null. */
  get hotspot() { return this._hotspot; }

  /** A digit or Escape, as typed in this window or the presenter view's; says whether it was used. */
  hotspotKey(key) {
    if (this._overview) return false;
    if (key === 'Escape') {
      if (!this._zoom || this.inking) return false;
      this.wholeSlide();
      return true;
    }
    if (!/^[0-9]$/.test(key)) return false;
    // Number keys are for hotspots only: without them they do nothing.
    if (this.hotspotMode === 'off') return false;
    if (key === '0') this.wholeSlide();
    else this.zoomToHotspot(Number(key));
    return true;
  }

  /** Fly to hotspot `n` (1-based); the same one again flies back out. */
  zoomToHotspot(n) {
    if (n === this._hotspot) { this.wholeSlide(); return true; }
    if (!this._hotspot) this._refreshHotspots();
    const spot = this._hotspots[n - 1];
    if (!spot) return false;
    this.flyZoom(spot.zoom, 'hotspot');
    this._hotspot = n;
    return true;
  }

  /** Fly back to the whole slide. */
  wholeSlide() {
    this._hotspot = null;
    if (!this._zoom && !this._zoomRaf) return;
    this.flyZoom(null, 'hotspot-reset');
    this._hotspot = null;
  }

  _queueHotspots() {
    if (this._hotspotRaf) return;
    // A hidden page gets no frames: its keys still need the hotspots.
    if (typeof requestAnimationFrame !== 'function' || document.hidden) { this._refreshHotspots(); return; }
    // A page in the background gets its frames late or not at all: a timer
    // stands in, whichever comes first.
    const run = () => {
      if (!this._hotspotRaf) return;
      cancelAnimationFrame(this._hotspotRaf); clearTimeout(this._hotspotTimer);
      this._hotspotRaf = 0;
      this._refreshHotspots();
    };
    this._hotspotRaf = requestAnimationFrame(run);
    this._hotspotTimer = setTimeout(run, 120);
  }

  // An element's box in design pixels, whatever the canvas's transform.
  _designRect(element) {
    const canvas = this._canvas.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    if (!canvas.width || !canvas.height) return null;
    const kx = this.designWidth / canvas.width, ky = this.designHeight / canvas.height;
    return { x: (box.left - canvas.left) * kx, y: (box.top - canvas.top) * ky, w: box.width * kx, h: box.height * ky };
  }

  _refreshHotspots() {
    if (!this._canvas || this._printing) return;
    const slide = this._slides[this._index];
    const design = { width: this.designWidth, height: this.designHeight };
    this._hotspots = findHotspots(slide, { mode: this.hotspotMode, design, max: ZOOM_MAX, rectOf: element => this._designRect(element) });
    this.toggleAttribute('data-has-hotspots', this._hotspots.length > 0);
    // The presenter's toolbar and the phone clicker list them (slideControls.js).
    this.dispatchEvent(new CustomEvent('hotspotschange', { detail: { count: this._hotspots.length } }));
    const layer = this._hotspotLayer;
    if (!layer) return;
    layer.replaceChildren(...this._hotspots.flatMap(({ rect }, i) => {
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'hotspot';
      badge.dataset.n = String(i + 1);
      badge.setAttribute('data-ink-ui', '');
      badge.textContent = String(i + 1);
      badge.title = `Zoom in (${i + 1})`;
      badge.setAttribute('aria-label', `Zoom in on part ${i + 1}`);
      badge.style.left = `${rect.x}px`;
      badge.style.top = `${rect.y}px`;
      const area = document.createElement('div');
      area.className = 'hotspot-area';
      Object.assign(area.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
      return [badge, area];
    }));
  }
};
