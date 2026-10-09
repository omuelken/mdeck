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
    'reader.appearance': 'Light or dark',
    'reader.light': 'Light',
    'reader.dark': 'Dark',
    'reader.drawings': 'Drawings',
    'reader.hideDrawings': 'Hide the drawings',
    'reader.showDrawings': 'Show the drawings',
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
    'slide.chapter': 'Chapter',
    'deck.controls': 'Deck controls',
    'deck.previous': 'Previous slide',
    'deck.next': 'Next slide',
    'deck.reset': 'Reset',
    'deck.resetHint': 'Reset to first slide',
    'poll.scan': 'Scan to vote',
    'video.sound': 'Click for sound',
    'poll.answer': '1 answer',
    'poll.answers': '{n} answers',
    'poll.reset': 'Reset',
    'poll.showAnswer': 'Show the right answer',
    'poll.hideAnswer': 'Hide the right answer',
    'poll.showResults': 'Show the results',
    'poll.hideResults': 'Hide the results',
    'poll.live': 'Live',
    'poll.offline': 'Not connected to the server',
    'poll.unreachable': 'Phones cannot reach this computer. Start with {command}, or set {setting}.',
    'poll.tryHere': 'Try the answer page here',
    'poll.static': 'Answered live during the talk.',
    'poll.pick': 'Tap one answer.',
    'poll.thanks': 'Thanks! You chose “{choice}”. Tap another to change.',
    'respond.waiting': 'The next question will appear here.',
    'respond.send': 'Send',
    'respond.sent': 'Sent. Thank you!',
    'join.scan': 'Scan to join',
    'follow.scan': 'Scan to follow the slides',
    'follow.open': 'Follow the slides',
    'follow.live': 'Live',
    'follow.back': 'Back to live',
    'follow.waiting': 'The talk has not started yet.',
    'follow.tryHere': 'Try following here',
    'join.static': 'During the talk, phones joined here to answer.',
    'poll.answeredOf': '{n} of {of} answered',
    'poll.close': 'Close: later answers do not count',
    'poll.open': 'Open again',
    'poll.closed': 'Closed',
    'poll.several': 'Several answers possible.',
    'poll.pickSeveral': 'Tap all that apply.',
    'poll.thanksSeveral': 'Thanks! You chose {choice}. Tap to change.',
    'respond.closed': 'Closed: no more answers.',
    'respond.right': 'Right!',
    'respond.wrong': 'Not quite. The right answer: {answer}',
    'respond.solution': 'The right answer: {answer}',
    'numeric.placeholder': 'A number',
    'numeric.invalid': 'Enter a number, such as 0.5 or 1/2.',
    'numeric.sent': 'Sent: {value}. Send another to change.',
    'numeric.other': 'Other',
    'numeric.right': '{n} right',
    'question.empty': 'Answers appear here.',
    'scale.average': 'Average {n}',
  },
  de: {
    'reader.outline': 'Gliederung',
    'reader.untitled': 'Folien',
    'reader.slides': 'Folien',
    'reader.read': 'Lesen',
    'reader.appearance': 'Hell oder dunkel',
    'reader.light': 'Hell',
    'reader.dark': 'Dunkel',
    'reader.drawings': 'Zeichnungen',
    'reader.hideDrawings': 'Zeichnungen ausblenden',
    'reader.showDrawings': 'Zeichnungen einblenden',
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
    'slide.chapter': 'Kapitel',
    'deck.controls': 'Foliensteuerung',
    'deck.previous': 'Vorherige Folie',
    'deck.next': 'Nächste Folie',
    'deck.reset': 'Neustart',
    'deck.resetHint': 'Zurück zur ersten Folie',
    'poll.scan': 'Scannen und abstimmen',
    'video.sound': 'Klicken für Ton',
    'poll.answer': '1 Antwort',
    'poll.answers': '{n} Antworten',
    'poll.reset': 'Zurücksetzen',
    'poll.showAnswer': 'Richtige Antwort zeigen',
    'poll.hideAnswer': 'Richtige Antwort ausblenden',
    'poll.showResults': 'Ergebnis zeigen',
    'poll.hideResults': 'Ergebnis ausblenden',
    'poll.live': 'Live',
    'poll.offline': 'Keine Verbindung zum Server',
    'poll.unreachable': 'Handys erreichen diesen Computer nicht. Mit {command} starten oder {setting} setzen.',
    'poll.tryHere': 'Antwortseite hier ausprobieren',
    'poll.static': 'Im Vortrag live beantwortet.',
    'poll.pick': 'Eine Antwort antippen.',
    'poll.thanks': 'Danke! Gewählt: „{choice}“. Zum Ändern eine andere antippen.',
    'respond.waiting': 'Die nächste Frage erscheint hier.',
    'respond.send': 'Senden',
    'respond.sent': 'Gesendet. Danke!',
    'join.scan': 'Scannen und mitmachen',
    'follow.scan': 'Scannen und Folien mitverfolgen',
    'follow.open': 'Folien mitverfolgen',
    'follow.live': 'Live',
    'follow.back': 'Zur aktuellen Folie',
    'follow.waiting': 'Der Vortrag hat noch nicht begonnen.',
    'follow.tryHere': 'Mitverfolgen hier ausprobieren',
    'join.static': 'Im Vortrag haben sich hier die Handys zum Antworten verbunden.',
    'poll.answeredOf': '{n} von {of} haben geantwortet',
    'poll.close': 'Schliessen: spätere Antworten zählen nicht',
    'poll.open': 'Wieder öffnen',
    'poll.closed': 'Geschlossen',
    'poll.several': 'Mehrere Antworten möglich.',
    'poll.pickSeveral': 'Alle zutreffenden antippen.',
    'poll.thanksSeveral': 'Danke! Gewählt: {choice}. Zum Ändern antippen.',
    'respond.closed': 'Geschlossen: keine weiteren Antworten.',
    'respond.right': 'Richtig!',
    'respond.wrong': 'Leider nicht. Richtig ist: {answer}',
    'respond.solution': 'Richtig ist: {answer}',
    'numeric.placeholder': 'Eine Zahl',
    'numeric.invalid': 'Eine Zahl eingeben, z. B. 0,5 oder 1/2.',
    'numeric.sent': 'Gesendet: {value}. Zum Ändern eine andere senden.',
    'numeric.other': 'Andere',
    'numeric.right': '{n} richtig',
    'question.empty': 'Hier erscheinen die Antworten.',
    'scale.average': 'Durchschnitt {n}',
  },
}

export const LABEL_KEYS = Object.keys(LABELS.en)

// Callout titles by type (`::: tip`), in the deck's language; the deck's
// `callouts` setting replaces single titles.
export const CALLOUT_LABELS = {
  en: { note: 'Note',    tip: 'Tip',  important: 'Important', warning: 'Warning', caution: 'Caution',
    definition: 'Definition', theorem: 'Theorem', lemma: 'Lemma', corollary: 'Corollary', proof: 'Proof', example: 'Example', remark: 'Remark' },
  de: { note: 'Hinweis', tip: 'Tipp', important: 'Wichtig',   warning: 'Achtung', caution: 'Vorsicht',
    definition: 'Definition', theorem: 'Satz',    lemma: 'Lemma', corollary: 'Korollar',  proof: 'Beweis', example: 'Beispiel', remark: 'Bemerkung' },
}

export const CALLOUT_TYPES = Object.keys(CALLOUT_LABELS.en)

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
