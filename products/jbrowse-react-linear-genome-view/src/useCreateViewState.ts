import { useState } from 'react'

import createViewState from './createViewState.ts'

import type { ViewStateOptions } from './createViewState.ts'

export function useCreateViewState(opts: ViewStateOptions) {
  const [state] = useState(() => createViewState(opts))
  return state
}
