import { memo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Portal, alpha } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  tooltip: {
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    padding: '4px 8px',
    fontSize: theme.typography.fontSize,
    maxWidth: 300,
    wordWrap: 'break-word',
    zIndex: 100000,
  },
  row: {
    whiteSpace: 'nowrap',
  },
  colorBox: {
    width: 10,
    height: 10,
    display: 'inline-block',
    marginRight: 4,
  },
}))

const EXCLUDE_KEYS = new Set(['color', 'HP', 'name', 'id'])

const MultiVariantTooltip = memo(function MultiVariantTooltip({
  source,
  x,
  y,
}: {
  source: {
    color?: string
    [key: string]: unknown
  }
  x: number
  y: number
}) {
  const { classes } = useStyles()

  return (
    <Portal>
      <div
        className={classes.tooltip}
        style={{ transform: `translate(${x + 10}px, ${y + 10}px)` }}
      >
        {source.color ? (
          <div
            className={classes.colorBox}
            style={{ backgroundColor: source.color }}
          />
        ) : null}
        {Object.entries(source).map(([key, value]) =>
          !EXCLUDE_KEYS.has(key) && value !== undefined ? (
            <div key={key} className={classes.row}>
              {key}: {String(value)}
            </div>
          ) : null,
        )}
      </div>
    </Portal>
  )
})

export default MultiVariantTooltip
