import { h, render } from 'preact'
import '../editor/editor.css'
import { DesignApp } from '../editor/components/DesignApp.jsx'

render(<DesignApp />, document.getElementById('design-root'))
