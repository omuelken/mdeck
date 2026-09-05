import { h } from 'preact'

export function ConflictBanner({ onReload, onOverwrite }) {
  return <div class="banner">
    <span>The slide file was changed by another program while you had unsaved edits here.</span>
    <span class="spacer" />
    <button class="btn is-small" onClick={onReload}>Use the file from disk</button>
    <button class="btn is-small is-primary" onClick={onOverwrite}>Keep my edits</button>
  </div>
}
