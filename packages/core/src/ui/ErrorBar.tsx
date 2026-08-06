import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, IconButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import StackTraceButton from './StackTraceButton.tsx'

import type { ReactNode } from 'react'

const useStyles = makeStyles()({
  content: {
    wordBreak: 'break-word',
    textAlign: 'center',
    // displays wrap their canvas in user-select:none (e.g. the canvas
    // FeatureComponent root, inherited by DisplayChrome's error bar); re-enable
    // selection so the error text can be copied
    userSelect: 'text',
  },
})

export default function ErrorBar({
  error,
  onRetry,
  extraAction,
}: {
  error: unknown
  onRetry: () => void
  // Remedy specific to one kind of error, shown left of the shared stack-trace
  // and retry buttons (the GPU overlay's "switch to Canvas2D" is the only one).
  extraAction?: ReactNode
}) {
  const { classes } = useStyles()
  const message = `${error}`
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        // explicit, because DisplayChrome portals this into a
        // `pointer-events:none` overlay layer, where the default `auto` would be
        // inherited away and Retry would stop responding. Same box it claimed
        // inline — it already stops mousedown/click below, so it was never
        // click-through.
        pointerEvents: 'auto',
      }}
      onMouseDown={e => {
        e.stopPropagation()
      }}
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <Alert
        severity="error"
        action={
          <>
            {extraAction}
            <StackTraceButton error={error} />
            <Tooltip title="Retry">
              <IconButton
                data-testid="reload_button"
                onClick={() => {
                  onRetry()
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        <Tooltip title={message}>
          <div className={classes.content}>{message}</div>
        </Tooltip>
      </Alert>
    </div>
  )
}
