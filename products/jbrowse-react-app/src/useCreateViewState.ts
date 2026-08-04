import { useState } from 'react'

import createViewState from './createViewState.ts'

import type { CreateViewStateOptions } from './createViewState.ts'

/**
 * Build an engine once for a component's lifetime and hand back the model. For
 * components that render `<JBrowseApp viewState={...}>` themselves — driving
 * the app imperatively off the model, or composing it with their own chrome —
 * where `<JBrowse>`'s prop-shaped API doesn't fit.
 *
 * Options are read on the first render only. To swap assemblies or plugins,
 * remount via a React `key`; to swap the session, call `viewState.setSession`.
 */
export function useCreateViewState(opts: CreateViewStateOptions) {
  const [state] = useState(() => createViewState(opts))
  return state
}
