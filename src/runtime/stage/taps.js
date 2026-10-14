// Taps: short and still; controls on the slide keep theirs.
const TAP_MS = 350;
export const TAP_SLOP = 12;
// Swipes: mostly sideways, this far, this fast.
const SWIPE_MIN = 60;
const SWIPE_MS = 700;
const TAP_IGNORE = 'a, button, input, select, textarea, label, summary, iframe, video, audio, canvas, [contenteditable], [role="button"], [data-ink-ui], [data-no-tap], .overlay';

export const Taps = (Base) => class extends Base {
  // Fingers (and a pen while not drawing): a swipe to the left goes
  // forward, to the right back; on a zoomed slide a finger moves the view
  // instead. While not drawing, a tap on the left or right third of the
  // screen goes back or forward, as the tap zones did. A tap while drawing selects the stroke under it
  // (`inktap`, { slideId, point }); the selection then takes the pen.
  // Read from pointer events, so it works whatever pointer the device
  // reports, and controls on the slide (buttons, links, polls, embedded
  // frames) keep their own taps.
  _tapStart(e) {
    if (this._overview) { this._tap = null; return; }
    const finger = e.pointerType === 'touch' && !(this.inking && this.inkFinger);
    const pen = e.pointerType === 'pen' && !this.inking;
    this._tap = (finger || pen) && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  }

  _tapEnd(e) {
    const tap = this._tap;
    this._tap = null;
    if (!tap || tap.id !== e.pointerId || e.type !== 'pointerup') return;
    const dx = e.clientX - tap.x, dy = e.clientY - tap.y, ms = performance.now() - tap.t;
    if (e.composedPath().some(el => el.nodeType === 1 && el.matches(TAP_IGNORE))) return;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5 && ms <= SWIPE_MS) {
      if (dx < 0) this.next('swipe');
      else this.prev('swipe');
      return;
    }
    if (ms > TAP_MS || Math.hypot(dx, dy) > TAP_SLOP) return;
    // In a hotspot: a tap anywhere on the slide shows the whole slide again.
    if (this._hotspot) { this.wholeSlide(); return; }
    if (!this.inking) {
      // Not drawing: a tap on the left third goes back, on the right third forward.
      if (this._zoom) return;
      const x = e.clientX / window.innerWidth;
      if (x < 1 / 3) this.prev('tap');
      else if (x > 2 / 3) this.next('tap');
      return;
    }
    const slideId = this._inkSlideId();
    if (slideId) this.dispatchEvent(new CustomEvent('inktap', { detail: { slideId, point: this._inkPoint(e), radius: 22 }, bubbles: true, composed: true }));
  }
};
