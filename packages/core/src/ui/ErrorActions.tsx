import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Tooltip } from '@mui/material'

import StackTraceButton from './StackTraceButton.tsx'

import type { IconButtonProps } from '@mui/material'
import type { ReactNode } from 'react'

/**
 * What both error presentations offer, in one order: the remedy specific to
 * this error, the report dialog, then retry. A fragment, because only the
 * contents are shared — `ErrorBanner` floats them, `ErrorBar` hands them to an
 * Alert's action slot.
 *
 * Two copies kept in step by a comment, which had already drifted: only the
 * banner gated the report button on the error carrying a `stack`, withholding
 * the environment block and the prefilled issue link — the whole of what that
 * dialog is for — from anyone whose failure arrived as a string.
 */
export default function ErrorActions({
  error,
  onRetry,
  extraAction,
  color,
}: {
  error: unknown
  /** omitted by a presentation with nothing to retry */
  onRetry?: () => void
  /**
   * Remedy specific to one kind of error, shown left of the shared two. The GPU
   * banners' "Use Canvas2D" is the only one.
   */
  extraAction?: ReactNode
  color?: IconButtonProps['color']
}) {
  return (
    <>
      {extraAction}
      <StackTraceButton error={error} color={color} />
      {onRetry ? (
        <Tooltip title="Retry">
          <IconButton
            data-testid="reload_button"
            onClick={() => {
              onRetry()
            }}
            color={color}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      ) : null}
    </>
  )
}
