import { h, render } from 'preact'
import '../editor/editor.css'
import { App } from '../editor/components/App.jsx'

render(<App />, document.getElementById('editor-root'))
