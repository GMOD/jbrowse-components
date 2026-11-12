import { radToDeg } from '@jbrowse/core/util'
import TooLargeMessage from '@jbrowse/display-kit/TooLargeMessage'
import { TooLargeSlot } from '@jbrowse/display-kit/chromeOverlaySlots'
import { observer } from 'mobx-react'

import type { TooLargeSource } from '@jbrowse/display-kit/chromeOverlaySlots'

const LINE_PX = 90

/**
 * The linear displays' too-large banner and force-load button, across the
 * middle of the circle and level at any rotation. A second gated track sits
 * under the first.
 */
const TooLargeBanner = observer(function TooLargeBanner({
  model,
  line,
}: {
  model: TooLargeSource & {
    radiusPx: number
    view: { offsetRadians: number }
  }
  line: number
}) {
  const width = model.radiusPx * 1.4
  return (
    <g
      transform={`rotate(${-radToDeg(model.view.offsetRadians)} 0 0) translate(0 ${line * LINE_PX})`}
    >
      <foreignObject
        x={-width / 2}
        y={-model.radiusPx / 2}
        width={width}
        height={model.radiusPx}
        pointerEvents="none"
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <TooLargeSlot model={model} TooLarge={TooLargeMessage} />
          </div>
        </div>
      </foreignObject>
    </g>
  )
})

export default TooLargeBanner
