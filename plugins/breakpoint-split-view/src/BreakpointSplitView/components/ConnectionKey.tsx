import { CONNECTION_LABELS } from '@jbrowse/alignments-core'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { connectionLabel, useConnectionStyle } from './connectionStyle.ts'
import { drawnConnections } from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { ConnectionKind } from '@jbrowse/alignments-core'

const KIND_ORDER = Object.keys(CONNECTION_LABELS) as ConnectionKind[]

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

function keyEntries(model: BreakpointViewModel) {
  const { assemblies, overlayMatches, overlayTracks, showIntraviewLinks } =
    model
  const entries = new Map<string, { kind: ConnectionKind; isSplit: boolean }>()
  for (const { configuration } of overlayTracks) {
    const match = overlayMatches.get(configuration.trackId)
    const tracks = model.getMatchedTracks(configuration.trackId)
    if (
      match?.kind !== 'alignment' ||
      tracks.some(t => t.displays[0]?.regionTooLarge)
    ) {
      continue
    }
    const isSplit = !match.hasPairedReads
    for (const { kind } of drawnConnections({
      match,
      assemblies,
      tracks,
      levels: model.overlayLinksReads(configuration.trackId),
      showIntraviewLinks,
    })) {
      entries.set(connectionLabel(kind, isSplit), { kind, isSplit })
    }
  }
  return [...entries.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  )
}

const ConnectionKey = observer(function ConnectionKey({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const connectionStyle = useConnectionStyle()
  const entries = keyEntries(model)
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

export default ConnectionKey
