// The keys that do something right now, for the help that ? shows over the
// presenter view and the deck window. Each window has its own keys
// (main.jsx for the presenter view, deck-stage.js and ink/attach.js for the
// deck window); what is listed depends on the moment: the number keys only
// while the slide shown has hotspots (without them they do nothing), the
// drawing keys while drawing, L only with several
// languages, F only where the browser can go full screen.
//
// `view` is 'presenter' or 'deck'; `hotspots` whether the number keys zoom on
// the slide shown; `hotspotSwitch` whether the presenter view's switch (H) is
// on, which a slide's own setting can overrule; `inking` whether drawing is
// on; `canDraw` whether D works in this window; `fullscreen` whether F does;
// `drawer` whether N does (the presenter view's slide-only layout);
// `languages` whether L does; `blank` whether the screen is black (B);
// `overview` whether the grid of all slides (O) is open; `join` whether J
// works (a deck phones join) and `joinShown` whether
// the join code is over the slide;
// `mac` names the command key ⌘ instead of Ctrl.
// Returns groups: [{ title, keys: [{ keys: ['→', 'Space'], label }] }].

export const HELP_KEY = '?'

export function keyHelp({ view = 'deck', blank = false, join = false, joinShown = false, overview = false, hotspots = false, hotspotSwitch = hotspots, inking = false, canDraw = true, fullscreen = false, drawer = false, languages = false, mac = false } = {}) {
  const presenter = view === 'presenter'
  const command = mac ? '⌘' : 'Ctrl'
  const entry = (keys, label) => ({ keys, label })
  const groups = []

  groups.push({ title: 'Slides', keys: [
    entry(['→', 'Space', 'PgDn'], 'Next step or slide'),
    entry(['←', 'PgUp'], 'Previous step or slide'),
    ...(presenter
      ? [entry(['Home', 'R'], 'Back to the first slide')]
      : [entry(['Home'], 'First slide'), entry(['End'], 'Last slide'), entry(['R'], 'Back to the first slide, steps hidden again')]),
  ] })

  groups.push({ title: 'Presenting', keys: [
    ...(presenter ? [entry(['T'], 'Start or pause the timer')] : []),
    entry(['O'], overview ? 'Close the overview' : 'All slides, to pick one'),
    entry(['B', '.'], blank ? 'Show the slide again' : 'Black screen for the audience'),
    ...(join ? [entry(['J'], joinShown ? 'Hide the join code' : 'Show the join code over the slide')] : []),
    ...(presenter && drawer ? [entry(['N'], 'Show or hide the notes')] : []),
    ...(presenter ? [entry(['H'], hotspotSwitch ? 'Turn hotspots off' : 'Turn hotspots on')] : []),
    ...(presenter && languages ? [entry(['L'], 'Next language')] : []),
    ...(canDraw ? [entry(['D'], inking ? 'Stop drawing' : 'Draw on the slide')] : []),
    ...(!presenter ? [entry(['I'], 'Show or hide the drawings')] : []),
    ...(fullscreen ? [entry(['F'], 'Full screen')] : []),
  ] })

  if (overview) groups.push({ title: 'All slides', keys: [
    entry(['←', '→', '↑', '↓'], 'Move between the slides'),
    entry(['Enter'], 'Go to that slide'),
    entry(['O', 'Esc'], 'Back to the slide shown'),
  ] })

  if (hotspots && !overview) groups.push({ title: 'Hotspots', keys: [
    entry(['1–9'], 'Zoom to a part of the slide'),
    entry(['0', 'Esc'], 'Show the whole slide'),
  ] })

  // The drawing keys are those of the deck window's own frame; the presenter
  // view passes on only D.
  if (inking && !presenter) groups.push({ title: 'Drawing', keys: [
    entry(['Esc'], 'Stop drawing'),
    entry([`${command} Z`], 'Undo'),
    entry([`Shift ${command} Z`], 'Redo'),
    entry(['Delete'], 'Remove the selected drawing'),
  ] })

  groups.push({ title: 'Help', keys: [entry([HELP_KEY], 'Show or hide these keys'), entry(['Esc'], 'Close')] })
  return groups.filter(group => group.keys.length)
}

/** Whether a key event is the one that shows the help: ? without Ctrl, ⌘ or Alt. */
export const isHelpKey = event => event.key === HELP_KEY && !event.metaKey && !event.ctrlKey && !event.altKey
