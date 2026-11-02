import { observer } from 'mobx-react'

import type { ReactNode } from 'react'

/**
 * A row of the stack, reporting the reader driving it: a press, wheel or key
 * anywhere inside. Capture phase, so a child that stops propagation still
 * counts, and React's tree rather than the DOM's, so a menu or dialog the row
 * opens in a portal counts as the row too.
 */
export const RowTouchArea = observer(function RowTouchArea({
  className,
  testId,
  onTouch,
  children,
}: {
  className: string
  testId: string
  onTouch: () => void
  children: ReactNode
}) {
  return (
    <div
      className={className}
      data-testid={testId}
      onPointerDownCapture={() => {
        onTouch()
      }}
      onWheelCapture={() => {
        onTouch()
      }}
      onKeyDownCapture={() => {
        onTouch()
      }}
    >
      {children}
    </div>
  )
})
