import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { useConnectionStyle } from './connectionStyle.ts'
import { connectionKeyEntries } from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'

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
  const connectionStyle = useConnectionStyle()
  const entries = connectionKeyEntries(model)
  return entries.length > 0 ? (
    <div className={classes.key} data-testid="connection-key">
      {entries.map(({ kind, isSplit }) => {
        const { color, label } = connectionStyle(kind, isSplit)
        return (
          <span key={label} className={classes.entry}>
            <span className={classes.swatch} style={{ background: color }} />
            {label}
          </span>
        )
      })}
    </div>
  ) : null
})

export const SvgConnectionKey = observer(function SvgConnectionKey({
  model,
  canvasWidth,
}: {
  model: BreakpointViewModel
  canvasWidth: number
}) {
  const connectionStyle = useConnectionStyle()
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      testid="connection-key"
      entries={connectionKeyEntries(model).map(({ kind, isSplit }) => {
        const { color, label } = connectionStyle(kind, isSplit)
        return { key: label, label, color }
      })}
    />
  )
})

export default ConnectionKey
