import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { useConnectionKeyRows } from './connectionStyle.ts'
import { connectionKeyEntries } from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { KeyEntry } from './connectionStyle.ts'

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
  const rows = useConnectionKeyRows(connectionKeyEntries(model))
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
  entries,
  canvasWidth,
}: {
  entries: KeyEntry[]
  canvasWidth: number
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      testid="connection-key"
      entries={useConnectionKeyRows(entries)}
    />
  )
}

export default ConnectionKey
