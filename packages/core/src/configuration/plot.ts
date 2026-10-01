import {
  getSnapshot,
  getType,
  isArrayType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { bareFormOf, shorthandTargets } from './schemaTypes.ts'

import type { AnyConfigurationModel } from './types.ts'

/**
 * #api core/configuration
 * The grammar's settings, by the slot name every display that has one gives
 * it, and what each holds: what "Edit plot..." shows and an agent reads as a
 * display's `plot`. A display's plot is the ones its config declares
 * (`plotKeysOf`).
 */
export const PLOT_VOCABULARY: Readonly<Record<string, string>> = {
  marks: 'the marks drawn in order, each a mark and an encoding',
  transform: 'the steps run over the features before any mark',
  facet: 'one section per value of a field',
  rows: 'the rows: their field or order, labels, focus and tree',
  rowColor: 'the colour of each row label',
  color: 'the colour',
  baseColor: 'the per-base layer over the reads',
  arcColor: 'the colour of the arcs between mates',
  ribbonColor: 'the colour of the ribbons between lanes',
  laneLayers: 'the layers drawn over each lane',
  scales: 'the axes, scales.y the value axis',
  filter: 'the jexl: expressions a feature has to pass',
  filterBy: 'the read flags and tags a read has to pass',
}

/**
 * #api core/configuration
 * A display's plot settings as written: a key left out is left alone, and
 * `null` resets that setting. Untyped, since a value may be a shorthand the
 * schema lifts, and the schema is what judges it.
 */
export type Plot = Record<string, unknown>

/**
 * #api core/configuration
 * A worked example of a display's plot: the text it fills the editor with,
 * and what it does.
 */
export interface PlotExample {
  plot: string
  description: string
}

const LIFT_ID = 'plotLift'

/**
 * #api core/configuration
 * The plot keys a display config declares.
 */
export function plotKeysOf(conf: AnyConfigurationModel): string[] {
  const definition = getConfigurationSchemaMetadata(conf)?.definition ?? {}
  return Object.keys(PLOT_VOCABULARY).filter(key =>
    Object.hasOwn(definition, key),
  )
}

// A one-member object a shorthand would write as a bare value prints as that
// value, as a config file writes it: `color: "red"`, `facet: "strand"`.
function folded(member: unknown, value: unknown) {
  if (
    !isStateTreeNode(member) ||
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return value
  }
  const meta = getConfigurationSchemaMetadata(member as AnyConfigurationModel)
  const entries = Object.entries(value)
  if (!meta || meta.options.shorthandWith || entries.length !== 1) {
    return value
  }
  const [slot, bare] = entries[0]!
  const form = bareFormOf(bare)
  return form && shorthandTargets(meta)[form] === slot ? bare : value
}

/**
 * #api core/configuration
 * A display's plot as declared, defaults left off. A list sitting at a
 * default it shares with no other display, a default plot's marks, shows its
 * entries, since they are what is drawn.
 */
export function plotOf(conf: AnyConfigurationModel): Plot {
  const snapshot = getSnapshot<Record<string, unknown>>(conf)
  const plot: Plot = {}
  for (const key of plotKeysOf(conf)) {
    const member = (conf as unknown as Record<string, unknown>)[key]
    const value =
      snapshot[key] ??
      (isStateTreeNode(member) &&
      isArrayType(getType(member)) &&
      (member as unknown[]).length > 0
        ? getSnapshot(member)
        : undefined)
    if (value !== undefined) {
      plot[key] = folded(member, value)
    }
  }
  return plot
}

function checkKeys(draft: object, keys: readonly string[]) {
  const unknown = Object.keys(draft).filter(key => !keys.includes(key))
  if (unknown.length > 0) {
    throw new Error(
      `This display's plot is ${keys.join(', ')}, not ${unknown.join(', ')}`,
    )
  }
}

/**
 * #api core/configuration
 * The text as a plot, refusing a key the display's plot does not hold. The
 * schema is the parser past this point.
 */
export function parsePlot(text: string, keys: readonly string[]): Plot {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`A plot is one JSON object of ${keys.join(', ')}`)
  }
  checkKeys(parsed, keys)
  return parsed as Plot
}

function merged(draft: Plot, current: Plot) {
  const out: Plot = { ...current }
  for (const [key, value] of Object.entries(draft)) {
    if (value === null) {
      delete out[key]
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

/**
 * #api core/configuration
 * A draft as the display's config would hold it, through the schema's own
 * lift and checks: a shorthand becomes its object, a default falls off, and
 * what a config file is refused for throws, a key outside the plot included.
 * The node is never attached, so nothing on the display is touched; a display
 * reads its typed members off it. The draft is copied first, since MST
 * freezes what it creates from.
 */
export function liftPlot(
  conf: AnyConfigurationModel,
  draft: Plot,
): AnyConfigurationModel {
  checkKeys(draft, plotKeysOf(conf))
  return getType(conf).create({
    displayId: LIFT_ID,
    ...structuredClone(merged(draft, plotOf(conf))),
  }) as AnyConfigurationModel
}

/**
 * #api core/configuration
 * What applying a draft writes: each setting whose lifted value differs from
 * the plot, as the lifted value, and `null` for one it resets. A value
 * spelled another way but lifting to the same setting writes nothing.
 * Throws a refusal before anything is written.
 */
export function plotWrites(
  conf: AnyConfigurationModel,
  draft: Plot,
): Record<string, unknown> {
  const current = plotOf(conf)
  const lifted = plotOf(liftPlot(conf, draft))
  const writes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || compareStructural(lifted[key], current[key])) {
      continue
    }
    writes[key] = lifted[key] ?? null
  }
  return writes
}
