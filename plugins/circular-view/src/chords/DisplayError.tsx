import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { radToDeg } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import HatchCircle from './HatchCircle.tsx'

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}…` : str
}

const DisplayError = observer(function DisplayError({
  model,
  onClick,
  onRetry,
}: {
  model: {
    displayError: unknown
    radiusPx: number
    view: { offsetRadians: number }
  }
  onClick?: () => void
  onRetry?: () => void
}) {
  const palette = usePalette()
  const text = truncate(String(model.displayError), 80)
  return (
    <g
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={
        onClick
          ? () => {
              onClick()
            }
          : undefined
      }
    >
      <HatchCircle
        radius={model.radiusPx}
        fill={palette.error.light}
        hatchColor={palette.error.main}
        textRotationDeg={-radToDeg(model.view.offsetRadians)}
        text={
          <>
            <tspan x="0">
              {onClick ? `${text} (click for details)` : text}
            </tspan>
            {onRetry ? (
              <tspan
                x="0"
                dy="1.5em"
                data-testid="chord_retry"
                style={{ textDecoration: 'underline' }}
                onClick={event => {
                  event.stopPropagation()
                  onRetry()
                }}
              >
                Retry
              </tspan>
            ) : null}
          </>
        }
      />
    </g>
  )
})

export default DisplayError
