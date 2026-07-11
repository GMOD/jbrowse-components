import type { ErrorInfo } from 'react'
import { Component } from 'react'

interface Props {
  children: React.ReactNode
  FallbackComponent: React.FC<{ error: unknown; componentStack?: string }>
}

interface State {
  error: unknown
  componentStack?: string
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: undefined }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, componentStack: errorInfo.componentStack ?? undefined })
  }

  render() {
    return this.state.error ? (
      <this.props.FallbackComponent
        error={this.state.error}
        componentStack={this.state.componentStack}
      />
    ) : (
      this.props.children
    )
  }
}

export { ErrorBoundary }
