import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { chordColorForType } from '../svChordColor.ts'

import type { SvInspectorViewModel } from '../model.ts'

// the disc leaves the square's bottom-left corner empty at every size
const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.background.paper,
    opacity: 0.9,
    fontSize: 11,
    lineHeight: 1.4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    border: 'none',
    background: 'none',
    padding: 0,
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  filteredOut: {
    opacity: 0.4,
  },
  swatch: {
    boxSizing: 'border-box',
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 2,
  },
  count: {
    color: theme.palette.text.secondary,
  },
}))

function swatchStyle(type: string, swatch: 'filled' | 'hollow') {
  const color = chordColorForType(type)
  return swatch === 'filled'
    ? { background: color }
    : { border: `2px solid ${color}` }
}

const ChordLegend = observer(function ChordLegend({
  model,
}: {
  model: SvInspectorViewModel
}) {
  const { classes, cx } = useStyles()
  const { spreadsheet } = model.spreadsheetView
  const rows = model.svTypeLegend
  const filtering = rows.some(row => row.count === undefined)

  return rows.length > 0 ? (
    <div className={classes.legend}>
      {rows.map(({ type, label, count, swatch }) => {
        const shown = count !== undefined
        const action = filtering
          ? shown
            ? `Hide ${label}`
            : `Also show ${label}`
          : `Show only ${label}`
        return (
          <button
            key={type}
            type="button"
            aria-pressed={filtering && shown}
            className={cx(classes.row, !shown && classes.filteredOut)}
            title={
              swatch === 'hollow'
                ? `${action} (no chord of this type draws at this zoom)`
                : action
            }
            onClick={() => {
              spreadsheet?.toggleSvType(type)
            }}
          >
            {swatch ? (
              <div
                className={classes.swatch}
                style={swatchStyle(type, swatch)}
                aria-hidden
              />
            ) : null}
            <span>{label}</span>
            {shown ? <span className={classes.count}>{count}</span> : null}
          </button>
        )
      })}
    </div>
  ) : null
})

export default ChordLegend
