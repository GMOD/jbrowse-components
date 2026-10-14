import { Component } from 'react'

import { observer } from 'mobx-react'

import type React from 'react'

export interface EngineFallbackProps {
  error: unknown
  retry: () => void
}

const DefaultFallback = observer(function DefaultFallback({
  error,
  retry,
}: EngineFallbackProps) {
  return (
    <div role="alert" style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
      Could not build the view:{' '}
      {error instanceof Error ? error.message : String(error)}{' '}
      <button type="button" onClick={retry}>
        Retry
      </button>
    </div>
  )
})

/**
 * Catches what `useCreateViewState` rethrows from render when the engine
 * itself cannot be built (a hub genome that does not exist, a plugin that
 * fails to load), where there is no view yet for `ViewStatus` to draw. Wrap
 * the component that calls the hook. `retry` remounts it, which builds again.
 *
 * Its own class rather than `@jbrowse/core/ui/ErrorBoundary`: a bundler groups
 * that module with core's Material error UI, and importing it eagerly ships
 * ~40 KB gzip of Material with the page.
 */
export class EngineBoundary extends Component<
  {
    children: React.ReactNode
    fallback?: React.ComponentType<EngineFallbackProps>
  },
  { error: unknown; failed: boolean }
> {
  state = { error: undefined as unknown, failed: false }

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }

  retry = () => {
    this.setState({ error: undefined, failed: false })
  }

  render() {
    const Fallback = this.props.fallback ?? DefaultFallback
    return this.state.failed ? (
      <Fallback error={this.state.error} retry={this.retry} />
    ) : (
      this.props.children
    )
  }
}
