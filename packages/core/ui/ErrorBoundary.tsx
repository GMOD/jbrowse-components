import type { ErrorInfo } from 'react'
import React, { Component } from 'react'

interface Props {
  children: React.ReactNode
  FallbackComponent: React.FC<{ error: unknown }>
}

interface State {
  error: unknown
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: undefined }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error })
  }

  render() {
    return this.state.error ? (
      <this.props.FallbackComponent error={this.state.error} />
    ) : (
      this.props.children
    )
  }
}

export { ErrorBoundary }
