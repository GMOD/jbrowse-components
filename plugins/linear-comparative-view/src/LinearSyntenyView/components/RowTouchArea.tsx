import { wheelDrivesView } from '@jbrowse/core/util/wheelZoom'
import { observer } from 'mobx-react'

import type { ReactNode } from 'react'

/**
 * A row of the stack, reporting the reader driving it: a press or key anywhere
 * inside, or a wheel the row zooms or pans on — not one that scrolls the page
 * past it. Capture phase, so a child that stops propagation still counts, and
 * React's tree rather than the DOM's, so a menu or dialog the row opens in a
 * portal counts as the row too.
 */
export const RowTouchArea = observer(function RowTouchArea({
  className,
  testId,
  scrollZoom,
  onTouch,
  children,
}: {
  className: string
  testId: string
  scrollZoom: boolean
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
      onWheelCapture={event => {
        if (wheelDrivesView(event, scrollZoom)) {
          onTouch()
        }
      }}
      onKeyDownCapture={() => {
        onTouch()
      }}
    >
      {children}
    </div>
  )
})
