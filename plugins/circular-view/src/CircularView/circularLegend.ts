import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LegendItem, LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What a display on the circle offers the key: a ring composing `LegendMixin`
 * answers `legendSpec` (the density ramp), and a ring in any other mode, a chord
 * track or a ribbon track answers the one color it paints with.
 */
export interface CircularLegendSource {
  legendSpec?: LegendSpec
  legendColor?: string
  posColor?: string
}

interface LegendTrack {
  configuration: AnyConfigurationModel
  displays: CircularLegendSource[]
}

export interface CircularLegendHost extends IStateTreeNode {
  tracks: LegendTrack[]
}

function itemsFor(display: CircularLegendSource, name: string): LegendItem[] {
  const ramp = display.legendSpec?.sections
    .flatMap(s => s.items)
    .find(item => item.gradient)
  if (ramp) {
    return [{ ...ramp, label: name }]
  }
  const color = display.legendColor ?? display.posColor
  return color ? [{ label: name, color }] : []
}

/**
 * The circle's key: a row per track, named by the track, since a ring or a
 * chord carries no label of its own.
 */
export function circularLegendSpec(view: CircularLegendHost): LegendSpec {
  const session = getSession(view)
  const items = view.tracks.flatMap(track => {
    const display = track.displays[0]
    return display
      ? itemsFor(display, getTrackName(track.configuration, session))
      : []
  })
  return { sections: items.length ? [{ id: 'tracks', items }] : [] }
}
