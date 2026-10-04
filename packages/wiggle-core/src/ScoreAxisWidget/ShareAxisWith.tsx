import { LabeledCheckbox } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

import { autoscalePeers, autoscaleWith } from '../autoscaleGroup.ts'
import Section from './Section.tsx'

import type { AutoscalePeer } from '../autoscaleGroup.ts'
import type { ScoreAxisDisplay } from './types.ts'

function sharesAxis(
  display: ScoreAxisDisplay,
): display is ScoreAxisDisplay & AutoscalePeer {
  return display.setAutoscaleGroup !== undefined
}

// Offered once the view holds another track with a value axis to share. A tick
// writes the peers' config too, so each one's track saves.
export default observer(function ShareAxisWith({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  if (!sharesAxis(display)) {
    return null
  }
  const peers = autoscalePeers(display)
  if (peers.length === 0) {
    return null
  }
  const group = display.autoscaleGroup
  const inGroup = (peer: AutoscalePeer) =>
    group !== undefined && peer.autoscaleGroup === group
  return (
    <Section title="Share axis with">
      {peers.map(({ display: peer, key, name }) => (
        <LabeledCheckbox
          key={key}
          label={name}
          checked={inGroup(peer)}
          onChange={checked => {
            const chosen = new Set(
              peers.map(p => p.display).filter(p => p !== peer && inGroup(p)),
            )
            if (checked) {
              chosen.add(peer)
            }
            autoscaleWith(
              display,
              peers.map(p => p.display),
              chosen,
            )
            for (const d of [display, ...peers.map(p => p.display)]) {
              getContainingTrack(d).persistConfigurationNow?.()
            }
          }}
        />
      ))}
    </Section>
  )
})
