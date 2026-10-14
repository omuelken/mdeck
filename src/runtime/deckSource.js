// The deck's text and language, shared by every view in this window.
import deckFileContent, { language as fileLanguage, languages as deckLanguages } from 'virtual:slides'
import { THEME_METAS, PALETTES } from './themeLoader'

// The deck's text: the file's, or on the dev server with ?sample=1 the sample
// deck, which the design page's pictures show.
export let slidesContent = deckFileContent
export function showSampleDeck(content) { slidesContent = content }

// The deck's languages under `mdeck run`, one file each (talk.en.md beside
// talk.de.md); a deck in one language has none and shows no switch. The
// presenter view switches every window, keeping the slide and step: slides
// match by their place in the deck.
export const LANGUAGES = Object.keys(deckLanguages)
export let deckLang = fileLanguage
export function chooseLanguage(lang) {
  if (!LANGUAGES.includes(lang)) return false
  deckLang = lang
  slidesContent = deckLanguages[lang]
  return true
}
// A deck without `lang` is in the language its file name gives.
export const withFileLanguage = config => config.lang || !deckLang ? config : { ...config, lang: deckLang }

export function withConfigOverrides(deckConfig) {
  const url = new URL(window.location.href)
  const theme = url.searchParams.get('theme')
  const palette = url.searchParams.get('palette')
  const appearance = url.searchParams.get('appearance')
  // The presenter view and previews pass their choices in the address. An
  // empty ?palette= or ?appearance= means the theme's default, whatever the
  // deck sets; a missing one keeps the deck's.
  return {
    ...deckConfig,
    // A file sent to readers carries only the deck's own theme and palette;
    // others named in the address are left out rather than failing.
    ...(theme && THEME_METAS[theme] ? { theme } : {}),
    ...(palette !== null && (!palette || PALETTES[palette]) ? { palette: palette || undefined } : {}),
    ...(appearance !== null ? { appearance: appearance || undefined } : {}),
  }
}
