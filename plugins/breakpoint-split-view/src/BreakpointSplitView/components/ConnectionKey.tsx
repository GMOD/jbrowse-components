import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { drawnConnectionKey } from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { connectionKeyRows } from './connectionStyle.ts'

const useStyles = makeStyles()({
  key: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px 10px',
    marginLeft: 'auto',
    paddingRight: 4,
    fontSize: 11,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  },
  swatch: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 2,
  },
})

const ConnectionKey = observer(function ConnectionKey({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const rows = drawnConnectionKey(model, usePalette())
  return rows.length > 0 ? (
    <div className={classes.key} data-testid="connection-key">
      {rows.map(({ key, color, label }) => (
        <span key={key} className={classes.entry}>
          <span className={classes.swatch} style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  ) : null
})

export function SvgConnectionKey({
  rows,
  canvasWidth,
}: {
  rows: ReturnType<typeof connectionKeyRows>
  canvasWidth: number
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      testid="connection-key"
      entries={rows}
    />
  )
}

export default ConnectionKey
