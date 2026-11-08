import { useDelayedFlag } from '@jbrowse/core/ui/LoadingOverlay'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { progressLabel, radToDeg } from '@jbrowse/core/util'
import { keyframes, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import HatchCircle from './HatchCircle.tsx'

const duration = 1.4

const dash = keyframes({
  '0%': { strokeDashoffset: 187 },
  '50%': { strokeDashoffset: 46 },
  '100%': { strokeDashoffset: 187 },
})

const colors = keyframes({
  '0%, 100%': { stroke: '#4285f4' },
  '25%': { stroke: '#de3e35' },
  '50%': { stroke: '#f7c223' },
  '75%': { stroke: '#1b9a59' },
})

const useStyles = makeStyles()(() => ({
  path: {
    strokeDasharray: 187,
    strokeDashoffset: 50,
    animation: `${dash} ${duration}s ease-in-out infinite, ${colors} ${duration * 4}s ease-in-out infinite`,
  },
}))

const Loading = observer(function Loading({
  model,
  line,
}: {
  model: {
    radiusPx: number
    statusMessage?: string
    statusProgress?: number
    view: { offsetRadians: number }
  }
  line: number
}) {
  const { classes } = useStyles()
  const palette = usePalette()

  const shown = useDelayedFlag(true, 400)
  const { statusMessage, statusProgress } = model
  const label = progressLabel(statusMessage || 'Loading', statusProgress)

  return !shown ? null : (
    <HatchCircle
      radius={model.radiusPx}
      fill={palette.action.hover}
      hatchColor={palette.action.disabledBackground}
      discOpacity={line === 0 ? 1 : 0}
      textLine={line}
      textRotationDeg={-radToDeg(model.view.offsetRadians)}
      text={statusProgress === undefined ? `${label}…` : label}
    >
      {line === 0 ? (
        <circle
          className={classes.path}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          cx="0"
          cy="0"
          r="60"
        />
      ) : null}
    </HatchCircle>
  )
})

export default Loading
