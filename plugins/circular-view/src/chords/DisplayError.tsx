import { radToDeg } from '@jbrowse/core/util'
import { useTheme } from '@mui/material/styles'
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
  model: { error: unknown; radiusPx: number; view: { offsetRadians: number } }
  onClick?: () => void
  onRetry?: () => void
}) {
  const theme = useTheme()
  const text = truncate(String(model.error), 80)
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
        fill={theme.palette.error.light}
        hatchColor={theme.palette.error.main}
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
