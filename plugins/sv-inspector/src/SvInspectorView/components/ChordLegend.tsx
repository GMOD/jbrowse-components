import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { chordColorForType } from '../svChordColor.ts'

import type { SvInspectorViewModel } from '../model.ts'

// Over the circle rather than in the options bar above it, which is a fixed 52px
// the model subtracts from the circular view's height: a legend there would have
// come out of a radius that is already the scarce dimension in this view. The
// plot is a disc inscribed in a square box, so its bottom-left corner is empty
// at every size the inspector gives it.
const useStyles = makeStyles()(theme => ({
  container: {
    position: 'relative',
  },
  legend: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    // the chords run under the corner at some zooms, so the legend carries its
    // own ground rather than reading against whatever is behind it
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
  active: {
    fontWeight: 'bold',
  },
  swatch: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 2,
  },
  count: {
    color: theme.palette.text.secondary,
  },
}))

const ChordLegend = observer(function ChordLegend({
  model,
  children,
}: {
  model: SvInspectorViewModel
  children: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  const { spreadsheet } = model.spreadsheetView
  const tallies = spreadsheet?.visibleSvTypes ?? []

  return (
    <div className={classes.container}>
      {children}
      {tallies.length > 0 ? (
        <div className={classes.legend}>
          {tallies.map(({ type, label, count, tokens }) => {
            const active = spreadsheet?.svTypeFilter === type
            return (
              <button
                key={type}
                type="button"
                className={cx(classes.row, active && classes.active)}
                // a class the sheet has no SVTYPE column to filter on is still
                // worth counting, but clicking it could not narrow anything
                disabled={!tokens.length}
                title={
                  tokens.length
                    ? `Show only ${label} (click again for all)`
                    : undefined
                }
                onClick={() => {
                  spreadsheet?.setSvTypeFilter(active ? undefined : type)
                }}
              >
                <div
                  className={classes.swatch}
                  style={{ background: chordColorForType(type) }}
                  // the swatch is the color itself, so it has no text to read;
                  // the label beside it is the accessible name
                  aria-hidden
                />
                <span>{label}</span>
                <span className={classes.count}>{count}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})

export default ChordLegend
