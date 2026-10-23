import {
  getSnapshot,
  getType,
  isArrayType,
  isStateTreeNode,
  isType,
  unwrapType,
} from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import {
  colorProblems,
  colorSlotsOf,
  noticeLines,
  scaleEndProblems,
  scaleEndsOf,
  withImpliedField,
} from '../util/colorScale.ts'
import { mergeConfSettings } from './getConf.ts'
import { readConfObject } from './readConfObject.ts'
import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import {
  bareFormOf,
  isSlotDefinitionEntry,
  shorthandTargets,
} from './schemaTypes.ts'
import { refusingUndeclaredKeys } from './snapshotPreprocess.ts'

import type { ConfigurationSchemaMetadata } from './schemaRegistry.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

const plotLists = new WeakSet<IAnyType>()

/**
 * #api core/configuration
 * Marks a list of sub-schemas as a plot setting, as `plot: true` marks a slot
 * or a sub-schema; an MST array type has no options in which to set the flag.
 */
export function plotList<T extends IAnyType>(type: T): T {
  plotLists.add(unwrapType(type))
  return type
}

function isPlotEntry(entry: unknown) {
  return isSlotDefinitionEntry(entry)
    ? !!entry.plot
    : isType(entry) &&
        (!!getConfigurationSchemaMetadata(entry)?.options.plot ||
          plotLists.has(unwrapType(entry)))
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
 * A display's plot settings, what "Edit plot..." edits and an agent reads as
 * its `plot`: every slot, sub-schema and list its config declares with
 * `plot`, in the order it declares them.
 */
export function plotKeysOf(conf: AnyConfigurationModel): string[] {
  const definition = getConfigurationSchemaMetadata(conf)?.definition ?? {}
  return Object.keys(definition).filter(key => isPlotEntry(definition[key]))
}

// A one-member object a shorthand would write as a bare value prints as that
// value, as a config file writes it, at any depth: `color: "red"`,
// `facet: "strand"`, a list entry's `mark: "line"`.
function folded(member: unknown, value: unknown): unknown {
  if (!isStateTreeNode(member) || typeof value !== 'object' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return isArrayType(getType(member))
      ? value.map((entry, i) => folded((member as unknown[])[i], entry))
      : value
  }
  const meta = getConfigurationSchemaMetadata(member as AnyConfigurationModel)
  if (!meta) {
    return value
  }
  const node = member as unknown as Record<string, unknown>
  const members = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      folded(node[key], child),
    ]),
  )
  // the members a bare value lifts to besides its own, which a fold drops
  const { shorthandWith = {} } = meta.options
  const entries = Object.entries(members).filter(
    ([key, member]) => !(key in shorthandWith && shorthandWith[key] === member),
  )
  if (
    entries.length !== 1 ||
    Object.keys(members).length !== 1 + Object.keys(shorthandWith).length
  ) {
    return members
  }
  const [slot, bare] = entries[0]!
  const form = bareFormOf(bare)
  return form && shorthandTargets(meta)[form] === slot ? bare : members
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
 * Parses the text as a plot and throws on a key the display's plot lacks. The
 * schema parses the values after that.
 */
export function parsePlot(text: string, keys: readonly string[]): Plot {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`A plot is one JSON object of ${keys.join(', ')}`)
  }
  checkKeys(parsed, keys)
  return parsed as Plot
}

/**
 * #api core/configuration
 * How a draft is written to the plot. By default it patches, as a settings bag
 * does; `whole` takes it for the whole plot, as the "Edit plot..." text is.
 */
export interface PlotWriteOptions {
  /**
   * A setting the draft leaves out resets, and each setting it names is
   * replaced by what it says, so the draft states the plot entire.
   */
  whole?: boolean
}

// as a settings bag writes, so an object declaring `writes: 'members'` takes
// the members a draft names and keeps the rest
function merged(
  conf: AnyConfigurationModel,
  draft: Plot,
  current: Plot,
  { whole = false }: PlotWriteOptions,
) {
  const stated = Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value !== undefined),
  )
  if (whole) {
    return Object.fromEntries(
      Object.entries(stated).filter(([, value]) => value !== null),
    )
  }
  const out = mergeConfSettings(getType(conf), current, stated)
  for (const [key, value] of Object.entries(stated)) {
    if (value === null) {
      delete out[key]
    }
  }
  return out
}

/**
 * #api core/configuration
 * A draft as the display's config would hold it, through the schema's own
 * lift and checks: a shorthand becomes its object, a default falls off, and
 * what a config file is refused for throws, a key outside the plot included.
 * The draft writes over the plot as a settings bag does: a setting it leaves
 * out stays, `null` resets one, an object declaring `writes: 'whole'` replaces
 * the setting, and any other object takes the members it names, a `null`
 * member resetting that member. Under `whole` the draft is the plot entire.
 * The node is never attached, so nothing on the display is touched; a display
 * reads its typed members off it. The draft is copied first, since MST
 * freezes what it creates from.
 */
export function liftPlot(
  conf: AnyConfigurationModel,
  draft: Plot,
  options: PlotWriteOptions = {},
): AnyConfigurationModel {
  checkKeys(draft, plotKeysOf(conf))
  return refusingUndeclaredKeys(() =>
    getType(conf).create({
      displayId: LIFT_ID,
      ...structuredClone(merged(conf, draft, plotOf(conf), options)),
    }),
  ) as AnyConfigurationModel
}

/**
 * #api core/configuration
 * What applying a draft writes: each setting whose lifted value differs from
 * the plot, as the lifted value, and `null` for one it resets. A value
 * spelled another way but lifting to the same setting writes nothing.
 * Under `whole`, a setting the draft leaves out writes its reset.
 * Throws a refusal before anything is written.
 */
export function plotWrites(
  conf: AnyConfigurationModel,
  draft: Plot,
  options: PlotWriteOptions = {},
): Record<string, unknown> {
  const current = plotOf(conf)
  const lifted = plotOf(liftPlot(conf, draft, options))
  const keys = options.whole
    ? new Set([...Object.keys(current), ...Object.keys(draft)])
    : Object.keys(draft).filter(key => draft[key] !== undefined)
  const writes: Record<string, unknown> = {}
  for (const key of keys) {
    if (!compareStructural(lifted[key], current[key])) {
      writes[key] = lifted[key] ?? null
    }
  }
  return writes
}

function subConfOf(conf: AnyConfigurationModel, key: string) {
  const member = (conf as unknown as Record<string, unknown>)[key]
  return isStateTreeNode(member) ? (member as AnyConfigurationModel) : undefined
}

// `value` raw, as `colorSettingOf` reads it: a `jexl:` constant is a constant
// to judge, never a callback to evaluate here.
function membersOf(node: AnyConfigurationModel) {
  return (name: string): unknown =>
    name === 'value'
      ? (node as unknown as Record<string, unknown>).value
      : name in node
        ? readConfObject(node, name)
        : undefined
}

// A member by its path into `node`'s sub-schemas, unset where one is missing.
function pathMembersOf(node: AnyConfigurationModel) {
  return (path: readonly string[]): unknown => {
    const [head = '', ...rest] = path
    if (rest.length === 0) {
      return membersOf(node)(head)
    }
    const sub = subConfOf(node, head)
    return sub ? pathMembersOf(sub)(rest) : undefined
  }
}

// Every sub-schema under `node` whose options `holds`, by path, at any depth
// and not below one that does: a color channel's `fieldPresets` at
// `encoding.color` or `pileup.bases.encoding.color`, a value axis's
// `scaleFence` at `encoding.y.scale` or `coverage.encoding.y.scale`.
function nodesWith(
  node: AnyConfigurationModel,
  path: string,
  holds: (options: ConfigurationSchemaMetadata['options']) => unknown,
): [string, AnyConfigurationModel][] {
  const meta = getConfigurationSchemaMetadata(node)
  if (meta && holds(meta.options)) {
    return [[path, node]]
  }
  return Object.keys(meta?.definition ?? {}).flatMap(key => {
    const sub = subConfOf(node, key)
    return sub ? nodesWith(sub, `${path}.${key}`, holds) : []
  })
}

/**
 * What a lifted plot's color channels and value axes say together that the
 * display cannot draw as written, as corner-notice lines: each channel under
 * its schema's `fieldPresets` and each axis's ends under its `scaleFence`, as
 * `jbrowse validate` judges them.
 */
export function schemaPlotProblems(lifted: AnyConfigurationModel): string[] {
  return plotKeysOf(lifted).flatMap(key => {
    const node = subConfOf(lifted, key)
    return node
      ? [
          ...nodesWith(node, key, o => o.fieldPresets).flatMap(
            ([path, channel]) => {
              const { options } = getConfigurationSchemaMetadata(channel)!
              return noticeLines(
                path,
                colorProblems(
                  withImpliedField(
                    colorSlotsOf(pathMembersOf(channel)),
                    options.impliedField,
                  ),
                  options.fieldPresets!,
                ),
              )
            },
          ),
          ...nodesWith(node, key, o => o.scaleFence).flatMap(
            ([path, scale]) => {
              const fence =
                getConfigurationSchemaMetadata(scale)!.options.scaleFence
              return noticeLines(
                path,
                scaleEndProblems(scaleEndsOf(membersOf(scale), fence), {
                  fence,
                }),
              )
            },
          ),
        ]
      : []
  })
}
