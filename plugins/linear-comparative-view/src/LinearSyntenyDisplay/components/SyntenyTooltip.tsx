import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react'
import { Portal, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { useFloating } from '@floating-ui/react'
import { SanitizedHTML } from '@jbrowse/core/ui'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles()(theme => ({
  // these styles come from
  // https://github.com/mui-org/material-ui/blob/master/packages/material-ui/src/Tooltip/Tooltip.js
  tooltip: {
    position: 'absolute',
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

const SyntenyTooltip = observer(function ({
  x,
  y,
  title,
}: {
  x: number
  y: number
  title: string
}) {
  const [width, setWidth] = useState(0)
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const { classes } = useStyles()

  // must be memoized a la https://github.com/popperjs/@floating-ui/react/issues/391
  const virtElement = useMemo(
    () => ({
      getBoundingClientRect: () => {
        return {
          top: y,
          left: x + width / 2,
          bottom: y,
          right: x,
          width: 0,
          height: 0,
          x,
          y,
          toJSON() {},
        }
      },
    }),
    [x, y, width],
  )
  const { styles, attributes } = useFloating(virtElement, anchorEl)

  return title ? (
    <Portal>
      <div
        ref={ref => {
          setWidth(ref?.getBoundingClientRect().width || 0)
          setAnchorEl(ref)
        }}
        className={classes.tooltip}
        // zIndex needed to go over widget drawer
        style={{ ...styles.popper, zIndex: 100000 }}
        {...attributes.popper}
      >
        <SanitizedHTML html={title} />
      </div>
    </Portal>
  ) : null
})

export default SyntenyTooltip
