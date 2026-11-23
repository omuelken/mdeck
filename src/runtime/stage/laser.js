// Laser: a red glow with a white core. The trail stays while the pen is
// down; lifted, it waits LASER_JOIN_MS and then fades away as a whole
// within LASER_MS. A trail begun while the last one still waits joins it:
// both stay until the pen is lifted again and then fade together, so a
// shape drawn in a few strokes (an arrow) shows as one.
const LASER_GLOW = '#ff2a2a';
const LASER_CORE = '#ffffff';
const LASER_MS = 1200;
const LASER_JOIN_MS = 300;
// A trail whose end never arrives (the other window closed) goes after this.
const LASER_HELD_MS = 30000;
const LASER_STEP = 4;  // design px between the points of a held trail

// Laser -------------------------------------------------------------------
//
// Trails and dots by key ('local' for this window, others from the ink
// bus; another window sends each of its trails under a key of its own), in
// design pixels. While a pen is down a trail's points stay (time Infinity);
// when the last pen is lifted, every held point is stamped with that moment,
// and after LASER_JOIN_MS the trails fade evenly until they expire together
// LASER_MS later. A trail that begins before then holds the waiting points
// again. Frames run only while some trail is shown or fading.
export const Laser = (Base) => class extends Base {
  constructor() {
    super();
    this._laserFrame = this._laserFrame.bind(this);
    this._lasers = new Map();
    // Keys whose pen is down.
    this._laserHeld = new Set();
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
    if (start) {
      // Begun while the last trails wait: they are held with this one.
      const now = performance.now();
      for (const other of this._lasers.values()) for (const p of other.points) if (p[2] !== Infinity && now - p[2] < LASER_JOIN_MS) p[2] = Infinity;
    }
    this._laserHeld.add(key);
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

  /** The pen is lifted: once no pen is down, the held trails wait and then fade together. */
  laserRelease(key) {
    const entry = this._lasers.get(key);
    this._laserHeld.delete(key);
    if (!entry) return;
    clearTimeout(entry.heldTimer);
    if (this._laserHeld.size) return;
    const now = performance.now();
    for (const other of this._lasers.values()) for (const p of other.points) if (p[2] === Infinity) p[2] = now;
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
      entry.points = entry.points.filter(p => now - p[2] < LASER_JOIN_MS + LASER_MS);
      if (!entry.points.length && !entry.dot) { this._lasers.delete(key); continue; }
      // A held trail needs frames too: a zoom, a new size or another slide
      // must move it while the pen stays still.
      if (entry.points.length) running = true;
      if (entry.slideId && slideId && entry.slideId !== slideId) continue;
      // Each trail fades by its own time: a new one can start while the last
      // still fades; joined trails have the same time and fade together.
      const trails = [];
      entry.points.forEach((p, i, all) => {
        if (i === 0 || p[3] || p[2] !== all[i - 1][2]) trails.push([]);
        trails[trails.length - 1].push(p);
      });
      for (const trail of trails) {
        ctx.globalAlpha = Math.min(1, 1 - Math.max(0, now - trail[0][2] - LASER_JOIN_MS) / LASER_MS);
        // A red glow with a white core, the core drawn second.
        for (const [color, lineWidth, blur] of [[LASER_GLOW, 8, 14], [LASER_CORE, 3, 0]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.shadowBlur = blur;
          ctx.beginPath();
          trail.forEach((p, i) => {
            const [x, y] = at(p);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
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
