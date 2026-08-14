import { Component } from 'react'

import type { ErrorInfo } from 'react'

export interface FallbackProps {
  error: unknown
  componentStack?: string
  /** clear the caught error, remounting the children that threw */
  resetErrorBoundary: () => void
}

interface Props {
  children: React.ReactNode
  FallbackComponent: React.FC<FallbackProps>
  /**
   * clear the caught error when any of these changes, compared with `Object.is`
   * element by element. For the cause a caller can name — the display was
   * swapped, the view was replaced — so a banner does not outlive it.
   */
  resetKeys?: unknown[]
  /** runs before the error clears, on either reset path */
  onReset?: () => void
  /**
   * runs when an error is caught, BEFORE the fallback renders. For a caller
   * that has to record something durable about the failure — jbrowse-web marks
   * the session it was showing, so the next boot does not restore straight back
   * into the crash. An effect inside the fallback would be a render later and
   * one more thing that has to run correctly on the way down.
   */
  onError?: (error: unknown) => void
}

interface State {
  error: unknown
  componentStack?: string
  // the reset keys the FAILING render used. Compared against, rather than the
  // previous props, because the two differ in exactly the case that loops: a
  // throw arriving in the same update that changed a key. Against prevProps
  // that reads as "the keys changed, reset" and re-renders the children that
  // just threw, forever.
  keysAtError?: unknown[]
}

function keysChanged(a: unknown[] = [], b: unknown[] = []) {
  return a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: undefined }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    // guarded: this is the last boundary in some trees, and a throw from the
    // handler would escape React's error handling itself — replacing the error
    // the user was about to be shown with one from the code reporting it
    try {
      this.props.onError?.(error)
    } catch (e) {
      console.error(e)
    }
    this.setState({
      error,
      componentStack: errorInfo.componentStack ?? undefined,
      keysAtError: this.props.resetKeys,
    })
  }

  componentDidUpdate() {
    if (
      this.state.error !== undefined &&
      keysChanged(this.state.keysAtError, this.props.resetKeys)
    ) {
      this.resetErrorBoundary()
    }
  }

  resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({
      error: undefined,
      componentStack: undefined,
      keysAtError: undefined,
    })
  }

  render() {
    return this.state.error !== undefined ? (
      <this.props.FallbackComponent
        error={this.state.error}
        componentStack={this.state.componentStack}
        resetErrorBoundary={this.resetErrorBoundary}
      />
    ) : (
      this.props.children
    )
  }
}

export { ErrorBoundary }
