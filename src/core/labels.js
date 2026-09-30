// Words the audience sees — in the reader, the deck controls, polls and the
// answer page — in the deck's language. `lang` picks a set (the part before a
// hyphen, so `de-CH` uses `de`); `labels` in the deck settings replaces single
// entries. Tools for the presenter (presenter view, launch page, editor) stay
// in English.

export const LABELS = {
  en: {
    'reader.outline': 'Outline',
    'reader.untitled': 'Slides',
    'reader.slides': 'Slides',
    'reader.read': 'Read',
    'reader.look': 'Look',
    'reader.theme': 'Theme',
    'reader.colors': 'Colors',
    'reader.themeColors': 'Theme colors',
    'reader.resetLook': 'Reset to default',
    'reader.resetLookHint': 'Return to the look the deck was made with',
    'reader.senderLook': 'This is the look the deck was made with',
    'reader.downloadPdf': 'Download PDF',
    'reader.savePdf': 'Save as PDF…',
    'reader.savePdfHint': "Opens the browser's print dialog; choose Save as PDF",
    'reader.present': 'Present',
    'reader.previous': 'Previous',
    'reader.next': 'Next',
    'reader.copyLink': 'Copy link to this slide',
    'reader.linkCopied': 'Link copied',
    'reader.slide': 'Slide {n}',
    'deck.overview': 'Overview',
    'deck.controls': 'Deck controls',
    'deck.previous': 'Previous slide',
    'deck.next': 'Next slide',
    'deck.reset': 'Reset',
    'deck.resetHint': 'Reset to first slide',
    'poll.scan': 'Scan to vote',
    'poll.answer': '1 answer',
    'poll.answers': '{n} answers',
    'poll.reset': 'Reset',
    'poll.live': 'Live',
    'poll.offline': 'Not connected to the room server',
    'poll.unreachable': 'Phones cannot reach this computer. Start with {command}, or set {setting}.',
    'poll.tryHere': 'Try the answer page here',
    'poll.pick': 'Tap one answer.',
    'poll.thanks': 'Thanks! You chose “{choice}”. Tap another to change.',
    'respond.waiting': 'The next question will appear here.',
    'respond.send': 'Send',
    'respond.sent': 'Sent. Thank you!',
    'join.scan': 'Scan to join',
    'join.hint': 'Keep the page open: each question appears there.',
    'join.at': 'Join at {link}',
    'question.empty': 'Answers appear here.',
    'scale.average': 'Average {n}',
  },
  de: {
    'reader.outline': 'Gliederung',
    'reader.untitled': 'Folien',
    'reader.slides': 'Folien',
    'reader.read': 'Lesen',
    'reader.look': 'Aussehen',
    'reader.theme': 'Design',
    'reader.colors': 'Farben',
    'reader.themeColors': 'Farben des Designs',
    'reader.resetLook': 'Zurücksetzen',
    'reader.resetLookHint': 'Zum ursprünglichen Aussehen zurück',
    'reader.senderLook': 'Das ist das ursprüngliche Aussehen',
    'reader.downloadPdf': 'PDF herunterladen',
    'reader.savePdf': 'Als PDF sichern…',
    'reader.savePdfHint': 'Öffnet den Druckdialog des Browsers; dort „Als PDF sichern“ wählen',
    'reader.present': 'Präsentieren',
    'reader.previous': 'Zurück',
    'reader.next': 'Weiter',
    'reader.copyLink': 'Link zu dieser Folie kopieren',
    'reader.linkCopied': 'Link kopiert',
    'reader.slide': 'Folie {n}',
    'deck.overview': 'Übersicht',
    'deck.controls': 'Foliensteuerung',
    'deck.previous': 'Vorherige Folie',
    'deck.next': 'Nächste Folie',
    'deck.reset': 'Neustart',
    'deck.resetHint': 'Zurück zur ersten Folie',
    'poll.scan': 'Scannen und abstimmen',
    'poll.answer': '1 Antwort',
    'poll.answers': '{n} Antworten',
    'poll.reset': 'Zurücksetzen',
    'poll.live': 'Live',
    'poll.offline': 'Keine Verbindung zum Raum-Server',
    'poll.unreachable': 'Handys erreichen diesen Computer nicht. Mit {command} starten oder {setting} setzen.',
    'poll.tryHere': 'Antwortseite hier ausprobieren',
    'poll.pick': 'Eine Antwort antippen.',
    'poll.thanks': 'Danke! Gewählt: „{choice}“. Zum Ändern eine andere antippen.',
    'respond.waiting': 'Die nächste Frage erscheint hier.',
    'respond.send': 'Senden',
    'respond.sent': 'Gesendet. Danke!',
    'join.scan': 'Scannen und mitmachen',
    'join.hint': 'Seite offen lassen: Jede Frage erscheint dort.',
    'join.at': 'Mitmachen: {link}',
    'question.empty': 'Hier erscheinen die Antworten.',
    'scale.average': 'Durchschnitt {n}',
  },
}

export const LABEL_KEYS = Object.keys(LABELS.en)

let language = 'en'
let current = LABELS.en

export function labelSetFor(lang) {
  const base = String(lang ?? '').toLowerCase().split('-')[0]
  return Object.hasOwn(LABELS, base) ? base : 'en'
}

export function setDeckLanguage({ lang, labels } = {}) {
  language = typeof lang === 'string' && lang.trim() ? lang.trim() : 'en'
  const overrides = labels && typeof labels === 'object' && !Array.isArray(labels) ? labels : {}
  current = { ...LABELS[labelSetFor(language)], ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => typeof value === 'string')) }
}

/** Words for the <deck-stage> control bar. */
export function stageLabels() {
  return { controls: t('deck.controls'), previous: t('deck.previous'), next: t('deck.next'), reset: t('deck.reset'), resetHint: t('deck.resetHint') }
}

/** The deck's `lang`, for the page's language attribute. */
export function deckLanguage() {
  return language
}

// Fills {name} placeholders. With only strings it returns a string; when a
// value is anything else (such as a Preact element) it returns an array of
// parts, ready to render.
export function t(key, vars = {}) {
  const text = current[key] ?? LABELS.en[key] ?? key
  const parts = text.split(/\{(\w+)\}/).map((part, i) => i % 2 ? (Object.hasOwn(vars, part) ? vars[part] : `{${part}}`) : part)
  return parts.every(part => typeof part === 'string' || typeof part === 'number') ? parts.join('') : parts.filter(part => part !== '')
}
