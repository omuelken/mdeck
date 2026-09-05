// Debounced, serialized autosave. The queue owns the base hash: every
// successful save advances it, a conflict pauses saving until the UI decides.
export function createSaveQueue({ save, delay = 400, setTimeout = globalThis.setTimeout.bind(globalThis), clearTimeout = globalThis.clearTimeout.bind(globalThis), onSaving = () => {}, onSaved = () => {}, onConflict = () => {}, onError = () => {} }) {
  let base = null
  let latest = null
  let timer = null
  let inflight = null
  let paused = false

  function push(source) {
    latest = source
    if (paused) return
    clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  function flush() {
    clearTimeout(timer)
    timer = null
    if (inflight) return inflight
    if (latest == null || paused || base == null) return Promise.resolve()
    const source = latest
    latest = null
    onSaving()
    inflight = Promise.resolve()
      .then(() => save(source, base))
      .then(result => { base = result.hash; onSaved({ hash: result.hash, source }) })
      .catch(error => {
        if (error?.conflict) { paused = true; latest = latest ?? source; onConflict(error) }
        else { latest = latest ?? source; onError(error) }
      })
      .finally(() => { inflight = null; if (latest != null && !paused) push(latest) })
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
    pending: () => Boolean(latest != null || inflight || timer),
  }
}
