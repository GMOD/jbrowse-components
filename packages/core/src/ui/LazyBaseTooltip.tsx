import { Suspense, lazy } from 'react'

import type { ComponentProps } from 'react'

// The tooltip, behind its own chunk: @floating-ui is ~266KB and this is what
// lets the ui barrel export it without putting that on the startup path. A
// consumer that wants the eager component deep-imports './BaseTooltip.tsx'.
const Lazy = lazy(() => import('./BaseTooltip.tsx'))

export default function LazyBaseTooltip(props: ComponentProps<typeof Lazy>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  )
}
