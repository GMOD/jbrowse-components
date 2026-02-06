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
    maxWidth: 400,
    wordWrap: 'break-word',
    zIndex: 100000,
  },
  table: {
    borderCollapse: 'collapse',
  },
  keyCell: {
    whiteSpace: 'nowrap',
    paddingRight: 8,
    fontWeight: 'bold',
    verticalAlign: 'top',
  },
  valueCell: {
    whiteSpace: 'nowrap',
  },
  colorBox: {
    width: 10,
    height: 10,
    display: 'inline-block',
    marginRight: 4,
    verticalAlign: 'middle',
  },
  header: {
    whiteSpace: 'nowrap',
    paddingBottom: 2,
    textAlign: 'center',
  },
}))

const EXCLUDE_KEYS = new Set(['color', 'HP', 'name', 'baseName', 'id'])

const MultiVariantTooltip = memo(function MultiVariantTooltip({
  source,
  x,
  y,
}: {
  source: {
    color?: string
    name?: string
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
        {source.name ? (
          <div className={classes.header}>
            {source.color ? (
              <div
                className={classes.colorBox}
                style={{ backgroundColor: source.color }}
              />
            ) : null}
            <b>{source.name}</b>
          </div>
        ) : null}
        <table className={classes.table}>
          <tbody>
            {Object.entries(source).map(([key, value]) =>
              !EXCLUDE_KEYS.has(key) && value !== undefined ? (
                <tr key={key}>
                  <td className={classes.keyCell}>{key}</td>
                  <td className={classes.valueCell}>{String(value)}</td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </Portal>
  )
})

export default MultiVariantTooltip
