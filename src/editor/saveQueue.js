// Debounced, serialized autosave. The queue owns the base hash: every
// successful save advances it, a conflict pauses saving until the UI decides.
// A failed save is retried after a growing pause, up to RETRY_MAX.
const RETRY_MAX = 5000

export function createSaveQueue({ save, delay = 400, setTimeout = globalThis.setTimeout.bind(globalThis), clearTimeout = globalThis.clearTimeout.bind(globalThis), onSaving = () => {}, onSaved = () => {}, onConflict = () => {}, onError = () => {} }) {
  let base = null
  let latest = null
  let timer = null
  let inflight = null
  let paused = false
  let retryDelay = delay

  function schedule(ms) {
    clearTimeout(timer)
    timer = setTimeout(flush, ms)
  }

  function push(source) {
    latest = source
    if (paused) return
    schedule(delay)
  }

  // `options` go to `save`: the unload flush passes { keepalive: true } so
  // the request outlives the page. Text pushed while a save is in flight is
  // sent right after it.
  function flush(options) {
    clearTimeout(timer)
    timer = null
    if (inflight) return inflight.then(() => flush(options))
    if (latest == null || paused || base == null) return Promise.resolve()
    const source = latest
    latest = null
    onSaving()
    inflight = Promise.resolve()
      .then(() => save(source, base, options))
      .then(result => { base = result.hash; retryDelay = delay; onSaved({ hash: result.hash, source }) })
      .catch(error => {
        latest = latest ?? source
        if (error?.conflict) { paused = true; onConflict(error) }
        else { retryDelay = Math.min(retryDelay * 2, RETRY_MAX); onError(error); schedule(retryDelay) }
      })
      .finally(() => { inflight = null; if (latest != null && !paused && !timer) push(latest) })
    return inflight
  }

  return {
    push,
    flush,
    setBase(hash) { base = hash },
    base: () => base,
    // After a conflict: overwrite keeps the local text and saves it over the disk version.
    overwrite(hash) { base = hash; paused = false; return flush() },
    // Reload drops the local text in favour of the disk version.
    reload(hash) { base = hash; paused = false; latest = null },
    // A failed save, tried again now rather than after the pause.
    retry() { retryDelay = delay; return flush() },
    pending: () => Boolean(latest != null || inflight || timer),
  }
}
