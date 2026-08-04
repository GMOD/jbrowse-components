import { useState } from 'react'

import createViewState from './createViewState.ts'

import type { ViewStateOptions } from './createViewState.ts'

/**
 * Build an engine once for a component's lifetime and hand back the model — the
 * hook form of `createViewState`, so a component doesn't have to remember to
 * wrap it in `useState` (calling it in the render body rebuilds the whole
 * engine on every render).
 *
 * Options are read on the first render only. To swap the assembly or plugins,
 * remount via a React `key`.
 */
export function useCreateViewState(opts: ViewStateOptions) {
  const [state] = useState(() => createViewState(opts))
  return state
}
