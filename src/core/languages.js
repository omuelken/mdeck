// A deck in several languages is one file per language, side by side:
// talk.en.md and talk.de.md. The file name says the language; the part before
// it names the deck, so files with the same name in other languages belong
// together. A language is a two-letter code, with a region if needed (de-CH).

const LANGUAGE_FILE = /^(.+)\.([a-z]{2}(?:-[A-Za-z0-9]{2,8})?)\.md$/i

let names = null
try { names = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' }) } catch {}
// `talk.v1.md` or `talk.ok.md` is not a language; Intl knows which codes are.
const isLanguage = code => {
  try { return !names || names.of(code) !== undefined } catch { return false }
}

/** `{ name, lang }` for `talk.de.md`, or null when the file name names no language. */
export function languageOfFile(fileName) {
  const match = LANGUAGE_FILE.exec(fileName)
  if (!match || !isLanguage(match[2])) return null
  return { name: match[1], lang: match[2] }
}

/**
 * The languages among `fileNames` (one folder's files) that `fileName` is
 * written in, as `[{ lang, file }]` sorted by language, or an empty list when
 * there is no second language.
 */
export function languageFiles(fileName, fileNames) {
  const own = languageOfFile(fileName)
  if (!own) return []
  const found = fileNames
    .map(file => ({ file, language: languageOfFile(file) }))
    .filter(({ language }) => language && language.name === own.name)
    .map(({ file, language }) => ({ lang: language.lang, file }))
    .sort((a, b) => a.lang.localeCompare(b.lang))
  return found.length > 1 ? found : []
}

// Scripts written from right to left, by language; Intl knows it where the
// browser offers getTextInfo (not Firefox).
const RIGHT_TO_LEFT = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ks', 'ku', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi'])

/** 'rtl' for a language written from right to left (fa, ar, he …), else 'ltr'. */
export function textDirection(lang) {
  if (typeof lang !== 'string' || !lang.trim()) return 'ltr'
  try {
    const locale = new Intl.Locale(lang.trim())
    const info = locale.getTextInfo?.() ?? locale.textInfo
    if (info?.direction) return info.direction
  } catch {}
  return RIGHT_TO_LEFT.has(lang.trim().toLowerCase().split('-')[0]) ? 'rtl' : 'ltr'
}
