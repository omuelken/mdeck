const search = document.querySelector('#search')
const results = document.querySelector('#search-results')
const status = document.querySelector('#search-status')
let searchIndex
let searchVersion = 0

async function runSearch() {
  const version = ++searchVersion
  const query = search.value.trim().toLowerCase()
  results.replaceChildren()
  results.hidden = !query
  search.setAttribute('aria-expanded', String(!!query))
  if (!query) { status.textContent = ''; return }
  try {
    searchIndex ??= fetch('search.json').then(response => { if (!response.ok) throw new Error(); return response.json() })
    const index = await searchIndex
    if (version !== searchVersion) return
    const words = query.split(/\s+/)
    const matches = index.map(page => {
      const title = page.title.toLowerCase(), description = page.description.toLowerCase(), text = page.text.toLowerCase()
      return { ...page, score: words.every(word => `${title} ${description} ${text}`.includes(word)) ? words.reduce((score, word) => score + (title.includes(word) ? 10 : description.includes(word) ? 4 : 1), 0) : 0 }
    }).filter(page => page.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    status.textContent = `${matches.length} guides found.`
    if (!matches.length) {
      const message = document.createElement('p')
      message.textContent = 'No guides found. Try “picture”, “notes”, or “share”.'
      results.append(message)
    }
    for (const page of matches) {
      const link = document.createElement('a'), title = document.createElement('strong'), description = document.createElement('span')
      link.href = page.href
      title.textContent = page.title
      description.textContent = page.description
      link.append(title, description)
      results.append(link)
    }
  } catch {
    searchIndex = undefined
    const message = document.createElement('p')
    message.textContent = 'Search could not load. Use the guide menu, or open these pages with mdeck docs.'
    results.append(message)
  }
}
search.addEventListener('input', runSearch)
search.addEventListener('focus', () => { if (search.value.trim()) runSearch() })
search.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('a')?.focus() }
  if (event.key === 'Enter' && results.querySelector('a')) results.querySelector('a').click()
})
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.target.closest('input, textarea, select, [contenteditable]') && !event.metaKey && !event.ctrlKey) { event.preventDefault(); search.focus() }
  if (event.key === 'Escape') { results.hidden = true; search.setAttribute('aria-expanded', 'false'); if (results.contains(document.activeElement)) search.focus() }
})
document.addEventListener('click', event => { if (!event.target.closest('.search-box')) { results.hidden = true; search.setAttribute('aria-expanded', 'false') } })

const navigation = document.querySelector('.nav-shell')
const mobile = matchMedia('(max-width: 960px)')
function adaptNavigation() { navigation.open = !mobile.matches }
adaptNavigation()
mobile.addEventListener('change', adaptNavigation)

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = button.closest('figure').querySelector('code')
    try {
      await navigator.clipboard.writeText(code.textContent)
      button.textContent = 'Copied'
    } catch {
      const range = document.createRange()
      range.selectNodeContents(code)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      button.textContent = 'Selected — copy now'
    }
    setTimeout(() => { button.textContent = 'Copy' }, 2500)
  })
}

for (const example of document.querySelectorAll('[data-preview]')) {
  const frame = example.querySelector('iframe')
  let index = 0
  // Theme pictures and light or dark: the deck reloads in the new look on
  // the same slide. Light or dark starts on each theme's own.
  const themes = [...example.querySelectorAll('[data-theme]')]
  const switches = [...example.querySelectorAll('[data-set-appearance]')]
  let theme = themes.find(button => button.getAttribute('aria-checked') === 'true') ?? themes[0]
  let appearance = theme?.dataset.appearance ?? 'light'
  const show = () => {
    for (const button of themes) button.setAttribute('aria-checked', String(button === theme))
    for (const button of switches) button.setAttribute('aria-checked', String(button.dataset.setAppearance === appearance))
  }
  const reload = () => {
    const url = new URL(frame.src)
    url.searchParams.set('theme', theme.dataset.theme)
    url.searchParams.set('appearance', appearance === theme.dataset.appearance ? '' : appearance)
    url.hash = String(index + 1)
    frame.src = url.toString()
    show()
  }
  for (const button of themes) button.addEventListener('click', () => { theme = button; appearance = button.dataset.appearance; reload() })
  for (const button of switches) button.addEventListener('click', () => { appearance = button.dataset.setAppearance; reload() })
  show()
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || !event.data?.deckStateChanged) return
    index = event.data.deckStateChanged.index
  })
}

// Tabs: one panel at a time; without the script every panel shows.
for (const group of document.querySelectorAll('[data-tabs]')) {
  const tabs = [...group.querySelectorAll('[role="tab"]')]
  const select = tab => {
    for (const other of tabs) {
      const selected = other === tab
      other.setAttribute('aria-selected', String(selected))
      other.tabIndex = selected ? 0 : -1
      document.getElementById(other.getAttribute('aria-controls')).hidden = !selected
    }
  }
  tabs.forEach(tab => tab.addEventListener('click', () => select(tab)))
  group.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const index = tabs.indexOf(document.activeElement)
    if (index < 0) return
    const next = step ? tabs[(index + step + tabs.length) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : null
    if (!next) return
    event.preventDefault()
    select(next)
    next.focus()
  })
  select(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') ?? tabs[0])
}
