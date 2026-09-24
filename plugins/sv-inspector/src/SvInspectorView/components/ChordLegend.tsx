import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { chordColorForType } from '../svChordColor.ts'

import type { SvInspectorViewModel } from '../model.ts'

// the disc leaves the square's bottom-left corner empty at every size
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
          {tallies.map(({ type, label, count }) => {
            const active = spreadsheet?.svTypeFilter === type
            return (
              <button
                key={type}
                type="button"
                className={cx(classes.row, active && classes.active)}
                title={`Show only ${label} (click again for all)`}
                onClick={() => {
                  spreadsheet?.setSvTypeFilter(active ? undefined : type)
                }}
              >
                <div
                  className={classes.swatch}
                  style={{ background: chordColorForType(type) }}
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
