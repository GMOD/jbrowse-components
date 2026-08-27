import { Alert, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import ErrorActions from './ErrorActions.tsx'

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
          <ErrorActions
            error={error}
            onRetry={onRetry}
            extraAction={extraAction}
          />
        }
      >
        <Tooltip title={message}>
          <div className={classes.content}>{message}</div>
        </Tooltip>
      </Alert>
    </div>
  )
}
