import { h, Component } from 'preact'

// Keeps one broken slide from blanking the whole preview while editing. The
// stage still counts the slide, and the error clears when its source changes.
export class SlideErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, source: props.source }
  }

  static getDerivedStateFromProps(props, state) {
    return props.source !== state.source ? { error: null, source: props.source } : null
  }

  componentDidCatch(error) {
    this.setState({ error: error?.message ?? String(error) })
  }

  render({ id, children }, { error }) {
    if (!error) return children
    return <section class="slide slide--error" data-slide-id={id} data-label="Error">
      <div class="slide-body" style={{ padding: '80px', fontFamily: 'ui-monospace, monospace', fontSize: '28px' }}>
        <p>This slide could not be rendered.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    </section>
  }
}
