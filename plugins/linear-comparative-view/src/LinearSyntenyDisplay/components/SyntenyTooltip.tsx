import React from 'react'
import { observer } from 'mobx-react'
import { Portal, useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  useClientPoint,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { SanitizedHTML } from '@jbrowse/core/ui'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles()(theme => ({
  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.pxToRem(12),
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    padding: '4px 8px',
    pointerEvents: 'none',
    position: 'absolute',
    wordWrap: 'break-word',
  },
}))

const SyntenyTooltip = observer(function ({ title }: { title: string }) {
  const theme = useTheme()
  const { classes } = useStyles()

  const { refs, floatingStyles, context } = useFloating({
    placement: 'right',
  })

  const clientPoint = useClientPoint(context)
  const { getFloatingProps } = useInteractions([clientPoint])

  const popperTheme = theme?.components?.MuiPopper

  return title ? (
    <Portal container={popperTheme?.defaultProps?.container}>
      <div
        className={classes.tooltip}
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          pointerEvents: 'none',
          zIndex: 100000,
        }}
        {...getFloatingProps()}
      >
        <SanitizedHTML html={title} />
      </div>
    </Portal>
  ) : null
})

export default SyntenyTooltip
