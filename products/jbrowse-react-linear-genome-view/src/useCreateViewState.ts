import { useState } from 'react'

import createViewState from './createViewState.ts'

type ViewStateOptions = Parameters<typeof createViewState>[0]

export function useCreateViewState(opts: ViewStateOptions) {
  const [state] = useState(() => createViewState(opts))
  return state
}
