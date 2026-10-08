// The phone page the server serves at <server>/<code>. It needs no deck:
// the presenter's screen sends the activity on screen (what to ask and how to
// answer), the deck's look and the words in the deck's language, and this page
// shows them. Plain browser JavaScript, no build step.
(() => {
  const base = new URL('.', location.href)
  const code = location.pathname.split('/').filter(Boolean).pop()
  const root = document.getElementById('answer')
  const FALLBACK = {
    en: { waiting: 'The next question will appear here.', pick: 'Tap one answer.', thanks: 'Thanks! You chose “{choice}”. Tap another to change.', send: 'Send', sent: 'Sent. Thank you!', offline: 'Connecting…' },
    de: { waiting: 'Die nächste Frage erscheint hier.', pick: 'Eine Antwort antippen.', thanks: 'Danke! Gewählt: „{choice}“. Zum Ändern eine andere antippen.', send: 'Senden', sent: 'Gesendet. Danke!', offline: 'Verbinde…' },
  }
  let words = FALLBACK[navigator.language?.slice(0, 2) === 'de' ? 'de' : 'en']
  let current = null
  let connected = false
  let status = ''

  const me = (() => {
    try {
      let id = localStorage.getItem('mdeck-live-client')
      // randomUUID only exists on https or localhost, not at `mdeck run --network`'s http://192.168…
      if (!id) localStorage.setItem('mdeck-live-client', id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''))
      return id
    } catch { return String(Math.random()).slice(2) }
  })()
  const chosenKey = room => `mdeck-answer:${code}.${room}`
  const remembered = room => { try { return localStorage.getItem(chosenKey(room)) } catch { return null } }
  const remember = (room, value) => { try { localStorage.setItem(chosenKey(room), value) } catch {} }
  const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (all, name) => vars[name] ?? all)
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
      else if (value != null && value !== false) node.setAttribute(key, value === true ? '' : value)
    }
    node.append(...children.flat().filter(child => child != null))
    return node
  }

  // The deck's colours and fonts, as the presenter's screen shows them.
  function applyLook(look, lang) {
    if (lang) document.documentElement.lang = lang
    // No look: keep the one the page has, fonts included.
    if (!look?.tokens) return
    const style = document.documentElement.style
    for (const [name, value] of Object.entries(look?.tokens ?? {})) if (/^--[\w-]+$/.test(name)) style.setProperty(name, value)
    for (const [name, value] of Object.entries(look?.heading ?? {})) style.setProperty(`--answer-heading-${name}`, value)
    const wanted = (look?.fonts ?? []).filter(url => /^https:\/\//.test(url))
    for (const link of [...document.querySelectorAll('link[data-theme-font]')]) if (!wanted.includes(link.href)) link.remove()
    for (const url of wanted) if (!document.querySelector(`link[data-theme-font][href="${CSS.escape(url)}"]`)) document.head.append(el('link', { rel: 'stylesheet', href: url, 'data-theme-font': true }))
  }

  // A question or option drawn by the deck (Markdown and maths as MathML,
  // src/components/inlineText.js), kept to text, emphasis and MathML. The
  // nodes are moved out of the parsed document, never parsed again.
  const SAFE_TAGS = new Set('em strong b i code del s sub sup br math semantics annotation mrow mi mo mn ms mtext mspace msup msub msubsup mfrac msqrt mroot mstyle mover munder munderover mtable mtr mtd mpadded mphantom menclose'.split(' '))
  const SAFE_ATTRIBUTES = new Set('mathvariant display displaystyle scriptlevel stretchy fence separator symmetric largeop movablelimits accent accentunder lspace rspace minsize maxsize linethickness width height depth voffset columnalign rowalign columnspacing rowspacing notation encoding'.split(' '))
  const DROPPED = new Set('script style template noscript iframe object embed svg textarea title'.split(' '))
  function clean(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue
      if (child.nodeType !== Node.ELEMENT_NODE || DROPPED.has(child.localName)) { child.remove(); continue }
      clean(child)
      if (!SAFE_TAGS.has(child.localName)) { child.replaceWith(...child.childNodes); continue }
      for (const { name } of [...child.attributes]) if (!SAFE_ATTRIBUTES.has(name)) child.removeAttribute(name)
    }
    return node
  }
  const drawn = (html, text) => {
    if (typeof html !== 'string') return text
    const body = clean(new DOMParser().parseFromString(html, 'text/html').body)
    return el('span', { class: 'answer-rich' }, ...body.childNodes)
  }
  // "Thanks! You chose “{choice}”." with the option drawn.
  const thanks = (activity, value) => {
    const i = activity.options.indexOf(value)
    if (!words.thanks.includes('{choice}')) return words.thanks
    const [before, after] = words.thanks.split('{choice}')
    return [before, drawn(activity.optionsHtml?.[i], value), after]
  }

  async function answer(room, value) {
    const response = await fetch(new URL(`rooms/${encodeURIComponent(`${code}.${room}`)}`, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: me, data: { value } }) })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? String(response.status))
  }

  const FORMS = {
    // { question, options: [..] }: one of several answers, which can be changed.
    choice(activity, room) {
      const picked = remembered(room)
      return [
        el('div', { class: 'answer-options' }, activity.options.map((option, i) => el('button', {
          class: option === picked ? 'is-picked' : null, 'aria-pressed': String(option === picked),
          onclick: async () => {
            try { await answer(room, option); remember(room, option); status = thanks(activity, option) } catch (error) { status = error.message }
            render()
          },
        }, drawn(activity.optionsHtml?.[i], option)))),
        el('p', { class: 'answer-status', role: 'status' }, status || (picked ? thanks(activity, picked) : words.pick)),
      ]
    },
    // { question, placeholder, maxLength }: short text, as often as people like.
    text(activity, room) {
      const input = el('textarea', { rows: 3, maxlength: activity.maxLength ?? 200, placeholder: activity.placeholder ?? '' })
      const form = el('form', { class: 'answer-text', onsubmit: async event => {
        event.preventDefault()
        const value = input.value.trim()
        if (!value) return
        try { await answer(room, value); status = words.sent } catch (error) { status = error.message }
        render()
      } }, input, el('button', { type: 'submit' }, words.send))
      return [form, el('p', { class: 'answer-status', role: 'status' }, status)]
    },
    // { question, min, max, minLabel, maxLabel }: a number on a scale.
    scale(activity, room) {
      const picked = remembered(room)
      const steps = []
      for (let n = activity.min ?? 1; n <= (activity.max ?? 5); n++) steps.push(String(n))
      return [
        el('div', { class: 'answer-scale' }, steps.map(step => el('button', {
          class: step === picked ? 'is-picked' : null, 'aria-pressed': String(step === picked),
          onclick: async () => {
            try { await answer(room, Number(step)); remember(room, step); status = fill(words.thanks, { choice: step }) } catch (error) { status = error.message }
            render()
          },
        }, step))),
        (activity.minLabel || activity.maxLabel) && el('div', { class: 'answer-scale-labels' }, el('span', {}, activity.minLabel ?? ''), el('span', {}, activity.maxLabel ?? '')),
        el('p', { class: 'answer-status', role: 'status' }, status || (picked ? fill(words.thanks, { choice: picked }) : words.pick)),
      ]
    },
  }

  function render() {
    const activity = current?.activity
    const form = activity && FORMS[activity.type]
    // Without the filter, replaceChildren() writes a missing part out as "null".
    root.replaceChildren(...[
      form
        ? el('main', { class: 'answer' }, activity.question && el('h1', {}, drawn(activity.questionHtml, activity.question)), form(activity, current.room))
        : el('main', { class: 'answer answer--waiting' }, el('p', {}, connected ? words.waiting : words.offline)),
      current?.title ? el('footer', {}, current.title) : null,
      // The presenter's screen sends the link when other devices can follow the slides.
      /^https?:\/\//.test(current?.follow ?? '') ? el('a', { class: 'answer-follow', href: current.follow }, words.follow ?? 'Follow the slides') : null,
    ].filter(Boolean))
  }

  function follow(state) {
    const previous = current?.room
    current = state
    if (state?.labels) words = { ...words, ...state.labels }
    applyLook(state?.look, state?.lang)
    if (state?.room !== previous) status = ''
    render()
  }

  render()
  // view=phone: the presenter sees how many phones are connected.
  const source = new EventSource(new URL(`rooms/${encodeURIComponent(code)}/events?view=phone&device=phone`, base))
  source.addEventListener('snapshot', event => { connected = true; follow(JSON.parse(event.data).state) })
  source.addEventListener('error', () => { connected = false; render() })
  source.addEventListener('state', event => follow(JSON.parse(event.data).state))
})()
