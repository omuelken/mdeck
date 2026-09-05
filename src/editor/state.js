// The editor's single source of truth is the deck source string. Every change
// goes through `edit`, which applies a pure helper from src/core/editDeck.js,
// reparses, revalidates and records undo history.
import { parseSlides } from '../core/parseSlides.js'
import { validateDeck } from '../core/validateDeck.js'

const HISTORY_LIMIT = 200
const COALESCE_MS = 1000

function byId(list = []) { return Object.fromEntries(list.map(item => [item.id, item])) }

export function derive(source, manifests) {
  const deck = parseSlides(source)
  const diagnostics = validateDeck(deck, { templates: manifests.templates, themes: manifests.themes, palettes: manifests.palettes })
  return { deck, diagnostics }
}

export const initialState = {
  loaded: false, path: '', name: '', source: '', hash: null, savedSource: '',
  deck: null, diagnostics: [], registry: null, manifests: { templates: {}, themes: {}, palettes: {} }, warnings: [],
  selectedIndex: 0, tab: 'slide', inspectorMode: 'form',
  history: { past: [], future: [] },
  status: 'saved', conflict: null, error: null, preview: { error: null, slideCount: 0 },
}

const clamp = (index, deck) => Math.max(0, Math.min(index, deck.slides.length - 1))

export function selectedSlide(state) { return state.deck?.slides[state.selectedIndex] ?? null }

export function reduce(state, action) {
  switch (action.type) {
    case 'load': {
      const manifests = { templates: byId(action.registry?.templates), themes: byId(action.registry?.themes), palettes: byId(action.registry?.palettes) }
      const { deck, diagnostics } = derive(action.source, manifests)
      return { ...state, loaded: true, path: action.path, name: action.name, source: action.source, savedSource: action.source, hash: action.hash, deck, diagnostics,
        registry: action.registry ?? null, manifests, warnings: action.warnings ?? [], selectedIndex: clamp(state.selectedIndex, deck), history: { past: [], future: [] }, status: 'saved', conflict: null, error: null }
    }
    case 'edit': {
      const result = action.apply(state.deck)
      const source = typeof result === 'string' ? result : result.source
      const index = typeof result === 'string' ? action.selectIndex ?? state.selectedIndex : result.index
      if (source === state.source) return index === state.selectedIndex ? state : { ...state, selectedIndex: clamp(index, state.deck) }
      const now = action.now ?? Date.now()
      const last = state.history.past.at(-1)
      const coalesce = action.group && last?.group === action.group && now - last.time < COALESCE_MS
      const entry = { source: state.source, selectedIndex: state.selectedIndex, group: action.group ?? null, time: now }
      const past = coalesce ? [...state.history.past.slice(0, -1), { ...last, time: now }] : [...state.history.past, entry].slice(-HISTORY_LIMIT)
      const { deck, diagnostics } = derive(source, state.manifests)
      return { ...state, source, deck, diagnostics, selectedIndex: clamp(index, deck), history: { past, future: [] }, status: state.status === 'conflict' ? 'conflict' : 'unsaved' }
    }
    case 'undo':
    case 'redo': {
      const from = action.type === 'undo' ? state.history.past : state.history.future
      const entry = from.at(-1)
      if (!entry) return state
      const current = { source: state.source, selectedIndex: state.selectedIndex, group: null, time: 0 }
      const { deck, diagnostics } = derive(entry.source, state.manifests)
      const history = action.type === 'undo'
        ? { past: from.slice(0, -1), future: [...state.history.future, current] }
        : { past: [...state.history.past, current], future: from.slice(0, -1) }
      return { ...state, source: entry.source, deck, diagnostics, selectedIndex: clamp(entry.selectedIndex, deck), history, status: state.status === 'conflict' ? 'conflict' : entry.source === state.savedSource ? 'saved' : 'unsaved' }
    }
    case 'select': return { ...state, selectedIndex: clamp(action.index, state.deck) }
    case 'setTab': return { ...state, tab: action.tab }
    case 'setInspectorMode': return { ...state, inspectorMode: action.mode }
    case 'saving': return state.status === 'conflict' ? state : { ...state, status: 'saving', error: null }
    case 'saved': return { ...state, hash: action.hash, savedSource: action.source, status: state.status === 'conflict' ? 'conflict' : action.source === state.source ? 'saved' : 'unsaved', error: null }
    case 'saveError': return { ...state, status: 'error', error: action.message }
    case 'conflict': return { ...state, status: 'conflict', conflict: { source: action.source, hash: action.hash } }
    case 'resolveConflict': {
      if (!state.conflict) return state
      if (action.choice === 'overwrite') return { ...state, hash: state.conflict.hash, conflict: null, status: 'unsaved' }
      const { deck, diagnostics } = derive(state.conflict.source, state.manifests)
      const entry = { source: state.source, selectedIndex: state.selectedIndex, group: null, time: 0 }
      return { ...state, source: state.conflict.source, savedSource: state.conflict.source, hash: state.conflict.hash, deck, diagnostics, selectedIndex: clamp(state.selectedIndex, deck), history: { past: [...state.history.past, entry].slice(-HISTORY_LIMIT), future: [] }, conflict: null, status: 'saved' }
    }
    case 'externalChange': {
      if (action.hash === state.hash) return state
      if (state.status !== 'saved') return reduce(state, { type: 'conflict', source: action.source, hash: action.hash })
      const { deck, diagnostics } = derive(action.source, state.manifests)
      const entry = { source: state.source, selectedIndex: state.selectedIndex, group: null, time: 0 }
      return { ...state, source: action.source, savedSource: action.source, hash: action.hash, deck, diagnostics, selectedIndex: clamp(state.selectedIndex, deck), history: { past: [...state.history.past, entry].slice(-HISTORY_LIMIT), future: [] }, status: 'saved' }
    }
    case 'previewRendered': return { ...state, preview: { error: action.error ?? null, slideCount: action.slideCount ?? 0 } }
    default: return state
  }
}
