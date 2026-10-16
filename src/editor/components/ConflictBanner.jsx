import { h } from 'preact'

export function ConflictBanner({ onReload, onOverwrite }) {
  return <div class="banner">
    <span>The slide file was changed elsewhere (another program, or another editor page) while you had unsaved edits here.</span>
    <span class="spacer" />
    <button class="btn is-small" onClick={onReload}>Use the file from disk</button>
    <button class="btn is-small is-primary" onClick={onOverwrite}>Keep my edits</button>
  </div>
}
