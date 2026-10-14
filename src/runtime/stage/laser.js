// Laser: a red glow with a white core. The trail stays while the pen is
// down; lifted, it retracts from its tail within LASER_MS.
const LASER_GLOW = '#ff2a2a';
const LASER_CORE = '#ffffff';
const LASER_MS = 1200;
// A trail whose end never arrives (the other window closed) goes after this.
const LASER_HELD_MS = 30000;
const LASER_STEP = 4;  // design px between the points of a held trail

// Laser -------------------------------------------------------------------
//
// Trails and dots by key ('local' for this window, others from the ink
// bus), in design pixels. While the pen is down a trail's points stay
// (time Infinity); lifted, they are stamped so that they expire one after
// the other within LASER_MS, and the trail retracts from its tail. Frames
// run only while some trail is shown or retracting.
export const Laser = (Base) => class extends Base {
  constructor() {
    super();
    this._laserFrame = this._laserFrame.bind(this);
    this._lasers = new Map();
  }

  _laserEntry(key, slideId) {
    let entry = this._lasers.get(key);
    if (!entry) this._lasers.set(key, entry = { slideId, points: [], dot: null });
    if (slideId) entry.slideId = slideId;
    return entry;
  }

  /** Adds points to a laser trail, held until laserRelease; its dot moves to the last one. */
  laserTrail(key, slideId, points, { start = false } = {}) {
    if (!points?.length) return;
    const entry = this._laserEntry(key, slideId);
    points.forEach(([x, y], i) => {
      // A held trail grows as long as the pen is down: skip points that
      // add nothing visible, so a long trail stays cheap to draw.
      const last = entry.points[entry.points.length - 1];
      const begins = start && i === 0;
      if (!begins && last && last[2] === Infinity && Math.hypot(x - last[0], y - last[1]) < LASER_STEP) return;
      entry.points.push([x, y, Infinity, begins]);
    });
    if (key !== 'local') { clearTimeout(entry.heldTimer); entry.heldTimer = setTimeout(() => this.laserRelease(key), LASER_HELD_MS); }
    entry.dot = points[points.length - 1];
    this._kickLaser();
  }

  /** The pen is lifted: the held trail retracts from its tail. */
  laserRelease(key) {
    const entry = this._lasers.get(key);
    if (!entry) return;
    const held = entry.points.filter(p => p[2] === Infinity);
    const now = performance.now();
    held.forEach((p, i) => { p[2] = now - LASER_MS + LASER_MS * (i + 1) / held.length; });
    clearTimeout(entry.heldTimer);
    this._kickLaser();
  }

  /** Moves (or with null, hides) a laser dot. */
  laserDot(key, slideId, point) {
    const entry = this._lasers.get(key);
    if (!point && !entry) return;
    this._laserEntry(key, slideId).dot = point ? [point[0], point[1]] : null;
    this._kickLaser();
  }

  _kickLaser() {
    if (!this._laserRaf) this._laserRaf = requestAnimationFrame(this._laserFrame);
  }

  _laserFrame() {
    this._laserRaf = 0;
    const canvas = this._inkLaser;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const rect = this._canvas.getBoundingClientRect();
    const sx = rect.width / this.designWidth, sy = rect.height / this.designHeight;
    const at = ([x, y]) => [rect.left + x * sx, rect.top + y * sy];
    const now = performance.now();
    const slideId = this._inkSlideId();
    let running = false;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = LASER_GLOW;
    for (const [key, entry] of this._lasers) {
      // A lifted trail retracts from its start, so the first point of a
      // newer trail can go while an older one still shows: its mark that a
      // trail begins there passes to the next point, or the two would join.
      let begins = false;
      entry.points = entry.points.filter(p => {
        if (now - p[2] >= LASER_MS) { begins ||= !!p[3]; return false; }
        if (begins) { p[3] = true; begins = false; }
        return true;
      });
      if (!entry.points.length && !entry.dot) { this._lasers.delete(key); continue; }
      // A held trail needs frames too: a zoom, a new size or another slide
      // must move it while the pen stays still.
      if (entry.points.length) running = true;
      if (entry.slideId && slideId && entry.slideId !== slideId) continue;
      // A red glow with a white core, the core drawn second.
      for (const [color, lineWidth, blur] of [[LASER_GLOW, 8, 14], [LASER_CORE, 3, 0]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        entry.points.forEach((p, i) => {
          const [x, y] = at(p);
          if (i === 0 || p[3]) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      if (entry.dot) {
        const [x, y] = at(entry.dot);
        for (const [color, radius, blur] of [[LASER_GLOW, 8, 20], [LASER_CORE, 4, 0]]) {
          ctx.fillStyle = color;
          ctx.shadowBlur = blur;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.shadowBlur = 0;
    if (running) this._laserRaf = requestAnimationFrame(this._laserFrame);
  }
};
