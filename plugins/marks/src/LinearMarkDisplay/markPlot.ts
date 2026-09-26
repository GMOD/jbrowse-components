import { pluralize } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { markProblems } from './markProblems.ts'

import type { LinearMarkDisplayConfigModel } from './configSchema.ts'
import type {
  FacetSnapshot,
  MarkProblem,
  MarkSnapshot,
  RowsSnapshot,
  StepSnapshot,
} from './markProblems.ts'

/**
 * The display settings a plot is: what "Edit as JSON..." shows and what an
 * agent reads, edits and hands back to `applyDisplaySettings`. The rule list
 * reads the first four together, since every cross-slot rule —
 * `rows-beside-facet`, `cross-section-packing`, `packing-under-rows`, an
 * `unwritten-y` a display step satisfies — needs more than `marks` to fire;
 * `scales` is the axis they all stand on.
 */
export const MARK_PLOT_KEYS = [
  'marks',
  'transform',
  'facet',
  'rows',
  'scales',
] as const
export type MarkPlotKey = (typeof MARK_PLOT_KEYS)[number]

/** What the box lists above the text, one line each. */
export const MARK_PLOT_EXAMPLES = [
  {
    plot: '{"marks":[{"mark":"point","encoding":{"y":"score","color":{"field":"strand"}}}]}',
    description: 'a point per feature at its score, coloured by strand',
  },
  {
    plot: '{"facet":"HP","marks":[{"mark":"span"}]}',
    description: 'one band per haplotype, each packed on its own',
  },
  {
    plot: '{"marks":[{"mark":"bar","transform":[{"type":"bin","step":"auto"},{"type":"aggregate","ops":[{"op":"count"}]}],"minBpPerPx":100}]}',
    description: 'a count per zoom-following bin, drawn only zoomed out',
  },
  { plot: '{"facet":null}', description: 'stop faceting' },
]

/**
 * A partial plot as the user typed it: a key left out is left alone, and
 * `null` resets that slot, which is what `applyConfSettings` does with it
 * (ADR-146).
 *
 * Untyped on purpose. A config file may write a shorthand at any of these —
 * `facet: "HP"`, `encoding.color: "red"` — which the post-lift snapshot types
 * cannot spell, and the schema is what judges the difference. {@link
 * MarkPlotSettings} is the typed half.
 */
export interface MarkPlot {
  marks?: unknown
  transform?: unknown
  facet?: unknown
  rows?: unknown
  scales?: unknown
}

/** A plot the schema has lifted: shorthands expanded, defaults left off. */
export interface MarkPlotSettings {
  marks: MarkSnapshot[]
  transform: StepSnapshot[]
  facet?: FacetSnapshot
  rows?: RowsSnapshot
}

const SYNTHETIC_DISPLAY_ID = 'markPlotLift'

/** The plot a display declares, as the box opens on it. */
export function markPlotOf(snapshot: Record<string, unknown>): MarkPlot {
  const plot: MarkPlot = {}
  for (const key of MARK_PLOT_KEYS) {
    if (snapshot[key] !== undefined) {
      Object.assign(plot, { [key]: snapshot[key] })
    }
  }
  return plot
}

export function markPlotText(plot: MarkPlot): string {
  return JSON.stringify(plot, null, 2)
}

/**
 * The text as a plot, refusing what a settings bag cannot hold. The schema is
 * the parser past this point, so nothing here validates a value.
 */
export function parseMarkPlot(text: string): MarkPlot {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return raise('a plot is one JSON object, such as { "marks": [] }')
  }
  const unknown = Object.keys(parsed).filter(
    key => !(MARK_PLOT_KEYS as readonly string[]).includes(key),
  )
  return unknown.length > 0
    ? raise(
        `${unknown.join(', ')} ${unknown.length > 1 ? 'are not settings' : 'is not a setting'} this box writes, which are ${MARK_PLOT_KEYS.join(', ')}`,
      )
    : markPlotOf(parsed as Record<string, unknown>)
}

function raise(message: string): never {
  throw new Error(message)
}

function merged(plot: MarkPlot, current: MarkPlot) {
  const out: Record<string, unknown> = { ...current }
  for (const key of MARK_PLOT_KEYS) {
    if (plot[key] === null) {
      delete out[key]
    } else if (plot[key] !== undefined) {
      out[key] = plot[key]
    }
  }
  return out
}

/**
 * The plot the display would hold, through the schema's own lift and checks:
 * a shorthand becomes its object, a default falls off, and a mark type or a
 * stray key throws. The marks are the ones drawn, a default list included,
 * since a display built on this one names a default plot of its own. Every member of the bag is `closed` — `rows` inherits it
 * from `rowArrangementConfigSchema` — so the box refuses what a config file
 * refuses and swallows nothing.
 *
 * `current` is a snapshot, never a live node: MST will not re-create from one
 * that already sits in a tree. Nothing is attached, so nothing is destroyed —
 * the node is a root React never saw. The plot is copied first, since MST
 * freezes what it creates from and a caller's draft stays theirs to edit.
 */
export function liftMarkPlot(
  configSchema: LinearMarkDisplayConfigModel,
  plot: MarkPlot,
  current: MarkPlot,
): MarkPlotSettings {
  const node = configSchema.create({
    displayId: SYNTHETIC_DISPLAY_ID,
    ...structuredClone(merged(plot, current)),
  })
  const snapshot = getSnapshot<Record<string, unknown>>(node)
  return {
    marks: getSnapshot(node.marks) as MarkSnapshot[],
    transform: (snapshot.transform ?? []) as StepSnapshot[],
    facet: snapshot.facet as FacetSnapshot | undefined,
    rows: snapshot.rows as RowsSnapshot | undefined,
  }
}

/** Every rule the declared plot breaks. */
export function markPlotProblems({
  marks,
  facet,
  transform,
  rows,
}: MarkPlotSettings): MarkProblem[] {
  return markProblems(marks, facet, transform, rows)
}

/** Which settings a plot writes and which it resets, against what is declared. */
export function markPlotChanges(plot: MarkPlot, current: MarkPlot) {
  const moved = MARK_PLOT_KEYS.filter(
    key =>
      plot[key] !== undefined && !compareStructural(plot[key], current[key]),
  )
  return {
    sets: moved.filter(key => plot[key] !== null),
    clears: moved.filter(key => plot[key] === null),
  }
}

/** The settings bag a plot applies, holding only what moved. */
export function markPlotSettingsWritten(plot: MarkPlot, current: MarkPlot) {
  const { sets, clears } = markPlotChanges(plot, current)
  return Object.fromEntries([
    ...sets.map(key => [key, plot[key]]),
    ...clears.map(key => [key, null]),
  ])
}

/**
 * The line under the box: what applying does, then what the plot still says.
 * `lifted` is the plot as applied, so a `marks` reset the schema refills from
 * a default plot says so.
 */
export function summarizeMarkPlot(
  plot: MarkPlot,
  current: MarkPlot,
  problems: readonly MarkProblem[],
  lifted: MarkPlotSettings,
): string {
  const { sets, clears } = markPlotChanges(plot, current)
  const resetsMarks = clears.includes('marks') && lifted.marks.length > 0
  const cleared = resetsMarks ? clears.filter(key => key !== 'marks') : clears
  return [
    sets.length > 0 ? `Sets ${sets.join(', ')}` : '',
    cleared.length > 0 ? `Clears ${cleared.join(', ')}` : '',
    resetsMarks ? 'Resets marks to the default plot' : '',
    sets.length === 0 && clears.length === 0 ? 'No changes' : '',
    problems.length > 0
      ? `${problems.length} ${pluralize(problems.length, 'problem')}`
      : '',
  ]
    .filter(Boolean)
    .join('. ')
}
