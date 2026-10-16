// The deck file as both editor pages see it: loaded once, edited through
// `edit`, saved in the background, and kept in step with changes on disk,
// including those the other page makes.
import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks'
import { reduce, initialState } from './state.js'
import { loadDeck, saveSource, onServerEvent } from './api.js'
import { createSaveQueue } from './saveQueue.js'

// `isLive(file)` says whether a changed extension file is already shown by
// the page without a reload (the design page's open theme or palette).
export function useDeckDocument({ isLive = () => false } = {}) {
  const [state, dispatch] = useReducer(reduce, initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const [loadError, setLoadError] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [extensionsKey, setExtensionsKey] = useState(0)
  const isLiveRef = useRef(isLive)
  isLiveRef.current = isLive

  const queue = useMemo(() => createSaveQueue({
    save: saveSource,
    onSaving: () => dispatch({ type: 'saving' }),
    onSaved: info => dispatch({ type: 'saved', ...info }),
    onConflict: error => dispatch({ type: 'conflict', source: error.source, hash: error.hash }),
    onError: error => dispatch({ type: 'saveError', message: error.message }),
  }), [])

  const load = async () => {
    try {
      const payload = await loadDeck()
      dispatch({ type: 'load', ...payload })
      queue.setBase(payload.hash)
      setLoadError(null)
    } catch (error) { setLoadError(error.message) }
  }

  useEffect(() => {
    load()
    const offChanged = onServerEvent('mdeck:deck-changed', async ({ hash }) => {
      if (hash === stateRef.current.hash || hash === queue.base()) return
      try {
        const payload = await loadDeck()
        if (stateRef.current.status === 'saved') queue.setBase(payload.hash)
        dispatch({ type: 'externalChange', source: payload.source, hash: payload.hash })
      } catch {}
    })
    // Extension files changed on disk (by an editor page or another program):
    // refresh the registry and reload the preview frame, never the page. A
    // file the page already shows live needs no reload.
    const offExtensions = onServerEvent('mdeck:extensions-changed', async ({ file } = {}) => {
      try { const payload = await loadDeck(); dispatch({ type: 'setRegistry', registry: payload.registry }) } catch {}
      setExtensionsKey(key => key + 1)
      if (!isLiveRef.current(file)) setPreviewKey(key => key + 1)
    })
    // On leaving the page the request must outlive it.
    const flush = () => { if (queue.pending()) queue.flush({ keepalive: true }) }
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => { offChanged(); offExtensions(); window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', hidden) }
  }, [])

  useEffect(() => { if (state.loaded && state.status === 'unsaved') queue.push(state.source) }, [state.source, state.status, state.loaded])

  const edit = (apply, options = {}) => dispatch({ type: 'edit', apply, ...options })
  const resolve = choice => {
    const conflict = stateRef.current.conflict
    dispatch({ type: 'resolveConflict', choice })
    if (choice === 'overwrite') queue.overwrite(conflict.hash)
    else queue.reload(conflict.hash)
  }
  const reloadPreview = () => setPreviewKey(key => key + 1)
  const retry = () => queue.retry()
  return { state, stateRef, dispatch, edit, resolve, loadError, reload: load, retry, previewKey, extensionsKey, reloadPreview }
}
