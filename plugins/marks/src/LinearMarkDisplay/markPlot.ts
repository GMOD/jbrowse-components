import { scaleEndsOf } from '@jbrowse/core/util/colorScale'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { confNodeAt } from '@jbrowse/wiggle-core'

import { MARK_Y_PATHS } from './markYPaths.ts'

import type {
  AxisSnapshot,
  FacetSnapshot,
  MarkSnapshot,
  PlotSnapshot,
  RowsSnapshot,
  StepSnapshot,
} from './markProblems.ts'
import type { AnyConfigurationModel, Plot } from '@jbrowse/core/configuration'

/**
 * A partial plot as the user typed it, the display's `plot` (core's `Plot`):
 * a key left out is left alone, and `null` resets that setting.
 */
export type MarkPlot = Plot

/** What "Edit plot..." lists above the text, one line each. */
export const MARK_PLOT_EXAMPLES = [
  {
    plot: '{"marks":[{"mark":"point","encoding":{"y":"score","color":{"field":"strand"}}}]}',
    description: 'a point per feature at its score, colored by strand',
  },
  {
    plot: '{"facet":{"field":"HP","transform":[{"type":"pileup"}]},"marks":[{"mark":"span"}]}',
    description: 'one band per haplotype, each packed on its own',
  },
  {
    plot: '{"marks":[{"mark":"bar","transform":[{"type":"bin","step":"auto"},{"type":"aggregate","ops":[{"op":"count"}]}],"minBpPerPx":100}]}',
    description: 'a count per zoom-following bin, drawn only zoomed out',
  },
  { plot: '{"facet":null}', description: 'stop faceting' },
]

/** A plot the schema has lifted, typed as the rule list reads it. */
export interface MarkPlotSettings extends PlotSnapshot {
  marks: MarkSnapshot[]
  transform: StepSnapshot[]
}

/**
 * The settings the rule list reads off a lifted config: the marks drawn, a
 * default plot's included, and the snapshot's other four.
 */
export function markPlotSettingsOf(
  conf: AnyConfigurationModel,
): MarkPlotSettings {
  const node = conf as unknown as Record<string, AnyConfigurationModel>
  const snapshot = getSnapshot<Record<string, unknown>>(conf)
  return {
    marks: getSnapshot(node.marks!) as MarkSnapshot[],
    transform: (snapshot.transform ?? []) as StepSnapshot[],
    facet: snapshot.facet as FacetSnapshot | undefined,
    rows: snapshot.rows as RowsSnapshot | undefined,
    axis: axisOf(conf),
  }
}

function axisOf(conf: AnyConfigurationModel): AxisSnapshot {
  const scalePath = MARK_Y_PATHS.members.fence.slice(0, -1)
  const fence = MARK_Y_PATHS.members.fence.at(-1)!
  const scale = getSnapshot<Record<string, unknown>>(
    confNodeAt(conf, scalePath),
  )
  return {
    where: scalePath.join('.'),
    fence,
    ends: scaleEndsOf(name => scale[name], fence),
  }
}
