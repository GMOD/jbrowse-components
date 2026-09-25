import { coarseStripHTML, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  LegendItem,
  LegendSection,
  LegendSpec,
} from '@jbrowse/core/ui/legendSpec'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * What a display on the circle offers the key: a ring composing `LegendMixin`
 * answers `legendSpec` (a density ramp, or the colors a field paints), and a
 * ring in any other mode, a chord track or a ribbon track answers the one color
 * it paints with.
 */
export interface CircularLegendSource {
  legendSpec?: LegendSpec
  legendColor?: string
}

interface LegendTrack {
  configuration: AnyConfigurationModel
  displays: CircularLegendSource[]
}

export interface CircularLegendHost extends IStateTreeNode {
  tracks: LegendTrack[]
}

function isSwatch(item: LegendItem) {
  return item.color !== undefined || item.swatches !== undefined
}

/**
 * A track's part of the key: one row named by the track for a ramp or a single
 * color, else the sections of colors its display paints, titled by the track.
 */
function keyFor(
  display: CircularLegendSource,
  name: string,
  id: string,
): { row?: LegendItem; sections: LegendSection[] } {
  const sections = display.legendSpec?.sections ?? []
  const ramp = sections.flatMap(s => s.items).find(item => item.gradient)
  if (ramp) {
    return { row: { ...ramp, label: name }, sections: [] }
  }
  const painted = sections.filter(s => s.items.some(isSwatch))
  const [only, ...rest] = painted.flatMap(s => s.items.filter(isSwatch))
  if (only && rest.length > 0) {
    return {
      sections: painted.map(s => ({
        ...s,
        id: `${id}-${s.id}`,
        title: s.title ? `${name}: ${s.title}` : name,
      })),
    }
  }
  const color = only?.color ?? display.legendColor
  return {
    row: color === undefined ? undefined : { label: name, color },
    sections: [],
  }
}

/**
 * The circle's key, since a ring or a chord carries no label of its own: a row
 * per single-color or ramp track, then a section per track coloring by a field.
 */
export function circularLegendSpec(view: CircularLegendHost): LegendSpec {
  const session = getSession(view)
  const keys = view.tracks.flatMap((track, idx) => {
    const display = track.displays[0]
    const name = coarseStripHTML(getTrackName(track.configuration, session))
    return display ? [keyFor(display, name, `track${idx}`)] : []
  })
  const rows = keys.flatMap(k => (k.row ? [k.row] : []))
  return {
    sections: [
      ...(rows.length ? [{ id: 'tracks', items: rows }] : []),
      ...keys.flatMap(k => k.sections),
    ],
  }
}
