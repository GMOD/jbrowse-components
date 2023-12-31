import React from 'react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { Portal, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}
const useStyles = makeStyles()(theme => ({
  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
    pointerEvents: 'none',
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    padding: '4px 8px',
    fontSize: theme.typography.pxToRem(12),
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    wordWrap: 'break-word',
  },
}))

interface Props {
  message: React.ReactNode | string
}
const TooltipContents = React.forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {React.isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

const ArcTooltip = observer(function ({ contents }: { contents?: string }) {
  const { theme, classes } = useStyles()

  const { refs, floatingStyles, context } = useFloating({
    placement: 'right',
  })

  const clientPoint = useClientPoint(context)
  const { getFloatingProps } = useInteractions([clientPoint])

  const popperTheme = theme?.components?.MuiPopper
  return contents ? (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        className={classes.tooltip}
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 100000,
          pointerEvents: 'none',
        }}
        {...getFloatingProps()}
      >
        <TooltipContents message={contents} />
      </div>
    </Portal>
  ) : null
})

export default ArcTooltip
