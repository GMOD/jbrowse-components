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
 * it: what "Edit plot..." shows and an agent reads as a display's `plot`. A
 * display's plot is the ones its config declares (`plotKeysOf`).
 */
export const PLOT_VOCABULARY = [
  'marks',
  'transform',
  'facet',
  'rows',
  'rowColor',
  'color',
  'baseColor',
  'arcColor',
  'ribbonColor',
  'laneLayers',
  'scales',
  'filter',
  'filterBy',
] as const

/**
 * #api core/configuration
 * A display's plot settings as written: a key left out is left alone, and
 * `null` resets that setting. Untyped, since a value may be a shorthand the
 * schema lifts, and the schema is what judges it.
 */
export type Plot = Record<string, unknown>

const LIFT_ID = 'plotLift'

/** #api core/configuration The plot keys a display config declares. */
export function plotKeysOf(conf: AnyConfigurationModel): string[] {
  const definition = getConfigurationSchemaMetadata(conf)?.definition ?? {}
  return PLOT_VOCABULARY.filter(key => Object.hasOwn(definition, key))
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
  const unknown = Object.keys(parsed).filter(key => !keys.includes(key))
  if (unknown.length > 0) {
    throw new Error(
      `This display's plot is ${keys.join(', ')}, not ${unknown.join(', ')}`,
    )
  }
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
 * what a config file is refused for throws. The node is never attached, so
 * nothing on the display is touched; a display reads its typed members off
 * it. The draft is copied first, since MST freezes what it creates from.
 */
export function liftPlot(
  conf: AnyConfigurationModel,
  draft: Plot,
): AnyConfigurationModel {
  return getType(conf).create({
    displayId: LIFT_ID,
    ...structuredClone(merged(draft, plotOf(conf))),
  }) as AnyConfigurationModel
}

/** #api core/configuration The keys a draft sets and the ones it resets. */
export function plotChanges(draft: Plot, current: Plot) {
  const moved = Object.keys(draft).filter(key =>
    draft[key] === null
      ? current[key] !== undefined
      : draft[key] !== undefined &&
        !compareStructural(draft[key], current[key]),
  )
  return {
    sets: moved.filter(key => draft[key] !== null),
    clears: moved.filter(key => draft[key] === null),
  }
}

/**
 * #api core/configuration
 * The settings bag a draft applies through `applyDisplaySettings`, holding
 * only what moved, so a setting the draft repeats unchanged is not rewritten.
 */
export function plotSettingsWritten(draft: Plot, current: Plot) {
  const { sets, clears } = plotChanges(draft, current)
  return Object.fromEntries([
    ...sets.map(key => [key, draft[key]]),
    ...clears.map(key => [key, null]),
  ])
}
