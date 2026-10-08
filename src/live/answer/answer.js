// The phone page the server serves at <server>/<code>. It needs no deck:
// the presenter's screen sends the activity on screen (what to ask and how to
// answer), the deck's look and the words in the deck's language, and this page
// shows them. Plain browser JavaScript, no build step.
(() => {
  const base = new URL('.', location.href)
  const code = location.pathname.split('/').filter(Boolean).pop()
  const root = document.getElementById('answer')
  const FALLBACK = {
    en: {
      waiting: 'The next question will appear here.', pick: 'Tap one answer.', thanks: 'Thanks! You chose “{choice}”. Tap another to change.', send: 'Send', sent: 'Sent. Thank you!', offline: 'Connecting…',
      pickSeveral: 'Tap all that apply.', thanksSeveral: 'Thanks! You chose {choice}. Tap to change.', closed: 'Closed: no more answers.',
      right: 'Right!', wrong: 'Not quite. The right answer: {answer}', solution: 'The right answer: {answer}',
      number: 'A number', invalid: 'Enter a number, such as 0.5 or 1/2.', numberSent: 'Sent: {value}. Send another to change.',
    },
    de: {
      waiting: 'Die nächste Frage erscheint hier.', pick: 'Eine Antwort antippen.', thanks: 'Danke! Gewählt: „{choice}“. Zum Ändern eine andere antippen.', send: 'Senden', sent: 'Gesendet. Danke!', offline: 'Verbinde…',
      pickSeveral: 'Alle zutreffenden antippen.', thanksSeveral: 'Danke! Gewählt: {choice}. Zum Ändern antippen.', closed: 'Geschlossen: keine weiteren Antworten.',
      right: 'Richtig!', wrong: 'Leider nicht. Richtig ist: {answer}', solution: 'Richtig ist: {answer}',
      number: 'Eine Zahl', invalid: 'Eine Zahl eingeben, z. B. 0,5 oder 1/2.', numberSent: 'Gesendet: {value}. Zum Ändern eine andere senden.',
    },
  }
  let words = FALLBACK[navigator.language?.slice(0, 2) === 'de' ? 'de' : 'en']
  let current = null
  let connected = false
  let status = ''
  // What is typed into a number field, kept while the page redraws.
  let draft = ''

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
    node.append(...children.flat(Infinity).filter(child => child != null))
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
  // An option as this phone shows it: its key (A, B… with `buttons`), or drawn.
  const shown = (activity, value) => {
    const i = activity.options.indexOf(value)
    return activity.keys?.[i] ?? drawn(activity.optionsHtml?.[i], value)
  }
  // A sentence with nodes put in for {name}; without {name}, the sentence.
  const sentence = (text, name, part) => {
    if (!text.includes(`{${name}}`)) return text
    const [before, after] = text.split(`{${name}}`)
    return [before, part, after]
  }
  const listed = parts => parts.flatMap((part, i) => i ? [', ', part] : [part])

  // A number as src/components/Numeric.jsx reads it: 0.5, 0,5, −3, 1e-3, 1/2.
  function parseNumber(text) {
    const plain = String(text ?? '').trim().replace(/\s+/g, '').replace(/\u2212/g, '-').replace(/(\d),(\d)/g, '$1.$2')
    const parts = plain.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?:\/((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?))?$/i)
    if (!parts) return null
    const value = parts[2] ? Number(parts[1]) / Number(parts[2]) : Number(parts[1])
    return Number.isFinite(value) ? value : null
  }

  // The activity's controls (src/components/activity.jsx), from its room's
  // state: `closed`, and `revealed` with the `solution` once the right
  // answer shows. Only the state, not everyone's answers (?only=state).
  let controls = {}, controlRoom = null, controlSource = null
  function followControls(room) {
    if (room === controlRoom) return
    controlSource?.close()
    controlSource = null
    controls = {}
    controlRoom = room
    if (!room) return
    controlSource = new EventSource(new URL(`rooms/${encodeURIComponent(`${code}.${room}`)}/events?only=state`, base))
    const take = event => {
      const state = JSON.parse(event.data).state
      controls = state && typeof state === 'object' ? state : {}
      render()
    }
    controlSource.addEventListener('snapshot', take)
    controlSource.addEventListener('state', take)
  }
  // Once the right answer shows: whether this phone's was right, or what it is.
  const verdict = (answered, right, solution) => el('p', { class: `answer-verdict${answered ? (right ? ' is-right' : ' is-wrong') : ''}`, role: 'status' },
    answered ? (right ? words.right : sentence(words.wrong, 'answer', solution)) : sentence(words.solution, 'answer', solution))
  const statusLine = text => el('p', { class: 'answer-status', role: 'status' }, status || (controls.closed ? words.closed : text))

  async function answer(room, value) {
    const response = await fetch(new URL(`rooms/${encodeURIComponent(`${code}.${room}`)}`, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: me, data: { value } }) })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? String(response.status))
  }

  const FORMS = {
    // { question, options, optionsHtml | keys, multiple }: one answer, or with
    // `multiple` several, which can be changed. With `keys` the buttons show
    // A, B… (or 1, 2…) and the options are on the slide.
    choice(activity, room) {
      const several = !!activity.multiple
      const saved = remembered(room)
      let picks = []
      if (several) { try { picks = JSON.parse(saved ?? '[]') } catch {} }
      else if (saved != null) picks = [saved]
      picks = activity.options.filter(option => Array.isArray(picks) && picks.includes(option))
      const vote = async next => {
        try {
          await answer(room, several ? next : next[0])
          remember(room, several ? JSON.stringify(next) : next[0])
          status = ''
        } catch (error) { status = error.message }
        render()
      }
      const solution = controls.revealed && Array.isArray(controls.solution) ? activity.options.filter(option => controls.solution.includes(option)) : null
      const right = solution && (several ? picks.length === solution.length && picks.every(pick => solution.includes(pick)) : solution.includes(picks[0]))
      return [
        el('div', { class: activity.keys ? 'answer-keys' : 'answer-options' }, activity.options.map(option => {
          const on = picks.includes(option)
          return el('button', {
            class: on ? 'is-picked' : null, 'aria-pressed': String(on), disabled: !!controls.closed,
            onclick: () => vote(several ? activity.options.filter(o => o === option ? !on : picks.includes(o)) : [option]),
          }, several && !activity.keys ? el('span', { class: 'answer-check', 'aria-hidden': 'true' }) : null, shown(activity, option))
        })),
        statusLine(picks.length
          ? sentence(several ? words.thanksSeveral : words.thanks, 'choice', listed(picks.map(pick => shown(activity, pick))))
          : several ? words.pickSeveral : words.pick),
        solution?.length ? verdict(picks.length > 0, right, listed(solution.map(option => shown(activity, option)))) : null,
      ]
    },
    // { question, placeholder }: a number, typed; the latest one counts.
    numeric(activity, room) {
      const sent = remembered(room)
      const input = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'send', placeholder: activity.placeholder || words.number, disabled: !!controls.closed })
      input.value = draft
      input.addEventListener('input', () => { draft = input.value })
      const form = el('form', { class: 'answer-number', onsubmit: async event => {
        event.preventDefault()
        const text = input.value.trim()
        if (parseNumber(text) == null) { status = words.invalid; render(); return }
        try { await answer(room, text); remember(room, text); draft = ''; status = '' } catch (error) { status = error.message }
        render()
      } }, input, el('button', { type: 'submit', disabled: !!controls.closed }, words.send))
      const solution = controls.revealed && controls.solution && Number.isFinite(controls.solution.value) ? controls.solution : null
      const right = solution && sent != null && Math.abs(parseNumber(sent) - solution.value) <= (solution.tolerance ?? 0)
      return [
        form,
        statusLine(sent != null ? fill(words.numberSent, { value: sent }) : ''),
        solution ? verdict(sent != null, right, drawn(solution.html, solution.text)) : null,
      ]
    },
    // { question, placeholder, maxLength }: short text, as often as people like.
    text(activity, room) {
      const input = el('textarea', { rows: 3, maxlength: activity.maxLength ?? 200, placeholder: activity.placeholder ?? '', disabled: !!controls.closed })
      const form = el('form', { class: 'answer-text', onsubmit: async event => {
        event.preventDefault()
        const value = input.value.trim()
        if (!value) return
        try { await answer(room, value); status = words.sent } catch (error) { status = error.message }
        render()
      } }, input, el('button', { type: 'submit', disabled: !!controls.closed }, words.send))
      return [form, statusLine('')]
    },
    // { question, min, max, minLabel, maxLabel }: a number on a scale.
    scale(activity, room) {
      const picked = remembered(room)
      const steps = []
      for (let n = activity.min ?? 1; n <= (activity.max ?? 5); n++) steps.push(String(n))
      return [
        el('div', { class: 'answer-scale' }, steps.map(step => el('button', {
          class: step === picked ? 'is-picked' : null, 'aria-pressed': String(step === picked), disabled: !!controls.closed,
          onclick: async () => {
            try { await answer(room, Number(step)); remember(room, step); status = '' } catch (error) { status = error.message }
            render()
          },
        }, step))),
        (activity.minLabel || activity.maxLabel) && el('div', { class: 'answer-scale-labels' }, el('span', {}, drawn(activity.minLabelHtml, activity.minLabel ?? '')), el('span', {}, drawn(activity.maxLabelHtml, activity.maxLabel ?? ''))),
        statusLine(picked ? fill(words.thanks, { choice: picked }) : words.pick),
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
    if (state?.room !== previous) { status = ''; draft = '' }
    followControls(state?.activity ? state.room : null)
    render()
  }

  render()
  // view=phone: the presenter sees how many phones are connected.
  const source = new EventSource(new URL(`rooms/${encodeURIComponent(code)}/events?view=phone&device=phone`, base))
  source.addEventListener('snapshot', event => { connected = true; follow(JSON.parse(event.data).state) })
  source.addEventListener('error', () => { connected = false; render() })
  source.addEventListener('state', event => follow(JSON.parse(event.data).state))
})()
