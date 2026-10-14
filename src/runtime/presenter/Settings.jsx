// The settings popover: the layout, the look, the language, the timer and
// the size of the notes. On a phone it holds the controls the clicker's
// bar has no room for (`duringTalk`).
import { h } from 'preact'
import { S, PaletteSwatches } from '../chrome.jsx'
import { Icon } from '../../components/Icon.jsx'
import { Popover, PanelSection } from './PresenterChrome.jsx'
import { LANGUAGES } from '../deckSource.js'

const LAYOUTS = [['speaker', 'speaker', 'Speaker', 'Slide, notes and next slide side by side (a computer)'], ['slide', 'tablet', 'Slide only', 'The slide fills the screen, notes in a drawer (an iPad)'], ['remote', 'phone', 'Clicker', 'Notes, time and big buttons (a phone)']]

// A language's name in that language, for the switch's tooltip.
function languageName(lang) {
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) } catch { return lang }
}

export function Settings({ layout, onLayout, duringTalk, theme, themeMeta, onThemes, offered, shown, setPalette, setAppearance, lang, setLang, timer, noteSize, setNoteSize, launchPage }) {
  return <Popover class="presenter-settings" label="Settings" trigger={<Icon name="settings" size={18} style={{ display: 'block' }} />}>
    <PanelSection title="Layout">
      <span role="group" aria-label="Layout" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {LAYOUTS.map(([id, icon, name, hint]) => <button key={id} type="button" class={`presenter-layout presenter-layout--${id}`} title={hint} aria-pressed={layout === id} onClick={() => onLayout(id)}
          style={{ ...S.btn, ...(layout === id ? { background: '#2a2a2a', color: '#fff', borderColor: '#444' } : {}) }}><Icon name={icon} size={16} />{name}</button>)}
      </span>
    </PanelSection>
    {duringTalk && <PanelSection title="During the talk">
      <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{duringTalk}</span>
    </PanelSection>}
    <PanelSection title="Look" class="presenter-look">
      <span style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={onThemes} style={{ ...S.btn }} title="Choose the theme"><Icon name="grid" size={14} />{themeMeta?.title ?? theme}</button>
        <span class="presenter-appearance" role="group" aria-label="Light or dark" style={{ display: 'flex', gap: '2px' }}>
          {['light', 'dark'].map(mode => <button key={mode} type="button" aria-pressed={shown.appearance === mode} title={mode === 'light' ? 'Light: for bright rooms' : 'Dark: for dark rooms'} aria-label={mode === 'light' ? 'Light' : 'Dark'}
            onClick={() => setAppearance(mode === (themeMeta?.appearance ?? 'light') ? '' : mode)}
            style={{ ...S.btn, padding: '5px 8px', ...(shown.appearance === mode ? { background: '#2a2a2a', color: '#f0f0f0', borderColor: '#444' } : {}) }}><Icon name={mode === 'light' ? 'sun' : 'moon'} size={16} /></button>)}
        </span>
      </span>
      <span class="presenter-palette" role="group" aria-label="Palette" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {offered.map(p => <button key={p.id} type="button" class="presenter-palette-option" title={p.description} aria-pressed={shown.palette?.id === p.id}
          onClick={() => setPalette(p.id === themeMeta?.palette ? '' : p.id)}
          style={{ ...S.btn, justifyContent: 'flex-start', gap: '8px', border: 'none', background: shown.palette?.id === p.id ? '#2a2a2a' : 'transparent', color: shown.palette?.id === p.id ? '#f0f0f0' : '#aaa' }}>
          <PaletteSwatches tokens={p[shown.appearance] ?? {}} /><span>{p.title}{p.id === themeMeta?.palette ? <span style={{ color: '#666' }}> · theme default</span> : null}</span>
        </button>)}
      </span>
      {LANGUAGES.length > 0 && <span class="presenter-language" role="group" aria-label="Language" style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
        {LANGUAGES.map(code => <button key={code} type="button" aria-pressed={lang === code} title={`${languageName(code)} (L switches)`} onClick={() => setLang(code)}
          style={{ ...S.btn, padding: '5px 9px', ...(lang === code ? { background: '#2a2a2a', color: '#f0f0f0', borderColor: '#444' } : {}) }}>{code.toUpperCase()}</button>)}
      </span>}
    </PanelSection>
    <PanelSection title="Timer">
      <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button type="button" class="presenter-timer-reset" style={S.btn} onClick={timer.reset}><Icon name="reset" size={16} />Reset the timer</button>
        {!timer.rehearsing && <button type="button" class="presenter-rehearse" style={S.btn} title="Time each slide, then save the times into the deck" onClick={timer.startRehearsal}><Icon name="rehearse" size={16} />Rehearse</button>}
      </span>
    </PanelSection>
    <label class="presenter-note-size" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>Size of the notes</span>
      <span aria-hidden="true" style={{ marginInlineStart: 'auto', fontSize: '11px', color: '#888' }}>A</span>
      <input type="range" min="11" max="26" step="1" value={noteSize} aria-label="Size of the notes" onInput={e => setNoteSize(Number(e.currentTarget.value))} style={{ width: '96px', accentColor: '#888', cursor: 'pointer' }} />
      <span aria-hidden="true" style={{ fontSize: '17px', color: '#888' }}>A</span>
    </label>
    {launchPage && <a class="presenter-home" href={launchPage} style={{ ...S.btn, alignSelf: 'flex-start', boxSizing: 'border-box', textDecoration: 'none' }}><Icon name="home" size={16} />Back to the launch page</a>}
  </Popover>
}
