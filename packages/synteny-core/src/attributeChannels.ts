import type { AttributeRange } from './colorRamps.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The per-feature channels a color-by mode can paint.
 *
 * The four presets are always collected, because their modes exist whatever the
 * data is. Anything else comes from the track's own declaration — an ortholog
 * table's `attributeColumns` — rather than from whatever keys the features
 * happen to carry: a whole-genome PAF puts every `xx:i:` tag (NM, ms, AS, nn,
 * rl) on every feature, and shipping a Float32Array per tag over millions of
 * rows would cost tens of megabytes to offer modes nobody asked for.
 *
 * Collecting the declared set up front rather than the selected one is what
 * keeps switching modes free: colors are recomputed on the main thread, so a
 * channel that is already in hand costs no refetch.
 *
 * A declared column is numeric until a feature carries text in it. Text interns
 * into the channel's label list and writes its index into the same Float32Array
 * (exact to 2^24), so the payload has one shape either way; the channel then
 * reports its labels rather than a span, and a numeric cell seen after that
 * interns as its string form.
 */
export const PRESET_ATTRIBUTES = [
  'identity',
  'meanIdentity',
  'mappingQual',
  'dnds',
] as const

// `attributeColumns` is the MCScanBlocksAdapter slot naming an ortholog table's
// extra columns. Read straight off the adapter config the worker was handed: it
// is a declared, bounded list, and reaching for it here means no extra RPC
// argument to thread from the display and keep in sync.
export function declaredAttributes(adapterConfig: Record<string, unknown>) {
  const declared = adapterConfig.attributeColumns
  return Array.isArray(declared)
    ? declared.filter(x => typeof x === 'string')
    : []
}

/**
 * The reserved column carrying a label's color. It is declared in
 * `attributeColumns` so the adapter parses it, but no menu offers it as a mode.
 */
export const COLOR_COLUMN = 'color'

export function colorableColumns(declared: readonly string[]) {
  return declared.filter(column => column !== COLOR_COLUMN)
}

/**
 * One channel: its Float32Array, plus the range it has covered so far.
 *
 * The range rides on the channel rather than in a name-keyed map beside it
 * because both workers write every channel of every feature, which makes this
 * their innermost loop. Reaching a channel by name cost a dictionary lookup for
 * the buffer and a `Map.get`/`Map.set` pair for each end of the range, per
 * channel per feature — four preset channels over a whole-genome fetch is
 * millions of hash lookups to write four floats.
 */
export interface AttributeChannel {
  name: string
  array: Float32Array
  min: number
  max: number
  labels: string[]
  labelIndex: Map<string, number>
  labelColors: Record<string, string>
}

/** Read `name` off a feature as a number, -1 for anything that is not one. */
export function readAttribute(feature: Feature, name: string) {
  const value = feature.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : -1
}

/**
 * Write one feature's value into a channel, tracking the range as it goes.
 * Both workers call this per channel per feature, so it takes the resolved
 * channel rather than its name.
 */
export function writeAttribute(
  channel: AttributeChannel,
  index: number,
  value: number,
) {
  channel.array[index] = value
  if (value >= 0) {
    if (value < channel.min) {
      channel.min = value
    }
    if (value > channel.max) {
      channel.max = value
    }
  }
}

function fileColor(feature: Feature) {
  const color: unknown = feature.get(COLOR_COLUMN)
  return typeof color === 'string' && color !== '' ? color : undefined
}

function internLabel(
  channel: AttributeChannel,
  label: string,
  color: string | undefined,
) {
  if (color !== undefined && channel.labelColors[label] === undefined) {
    channel.labelColors[label] = color
  }
  const known = channel.labelIndex.get(label)
  if (known !== undefined) {
    return known
  }
  const index = channel.labels.length
  channel.labels.push(label)
  channel.labelIndex.set(label, index)
  return index
}

/**
 * Write whatever the feature carries under the channel's name: a number as
 * itself, text as its label index, anything else as missing.
 */
export function writeFeatureAttribute(
  channel: AttributeChannel,
  index: number,
  feature: Feature,
) {
  const value: unknown = feature.get(channel.name)
  if (typeof value === 'string' && value !== '') {
    if (channel.labels.length === 0 && Number.isFinite(channel.min)) {
      // numbers already written read as label indices from here on, so they
      // become labels of their own
      for (let i = 0; i < index; i++) {
        const earlier = channel.array[i]!
        if (earlier >= 0) {
          channel.array[i] = internLabel(channel, String(earlier), undefined)
        }
      }
    }
    channel.array[index] = internLabel(channel, value, fileColor(feature))
  } else if (channel.labels.length > 0 && typeof value === 'number') {
    channel.array[index] = internLabel(
      channel,
      String(value),
      fileColor(feature),
    )
  } else {
    writeAttribute(
      channel,
      index,
      typeof value === 'number' && Number.isFinite(value) ? value : -1,
    )
  }
}

/**
 * Allocate one Float32Array per channel, fill it as features are visited, and
 * report the span or the label list each one actually covered.
 *
 * -1 is the missing-value sentinel every consumer already reads, so a channel a
 * feature does not carry is not zero. The reported range therefore ignores
 * missing values: a run of -1 would otherwise drag an attribute's domain bottom
 * below anything real and wash the ramp out.
 */
export function createAttributeChannels(
  names: readonly string[],
  count: number,
) {
  const list: AttributeChannel[] = [...new Set(names)].map(name => ({
    name,
    array: new Float32Array(count),
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    labels: [],
    labelIndex: new Map(),
    labelColors: {},
  }))
  return {
    /** The resolved channels, in declaration order — what the hot loop walks. */
    list,
    /** Truncate to the features actually kept, and close out the ranges. */
    finish(validCount: number) {
      const attributes: Record<string, Float32Array> = {}
      const attributeRanges: Record<string, AttributeRange> = {}
      for (const { name, array, min, max, labels, labelColors } of list) {
        attributes[name] = array.subarray(0, validCount)
        if (labels.length > 0) {
          attributeRanges[name] = { labels, colors: labelColors }
        } else if (Number.isFinite(min)) {
          // an attribute nothing carried has no range to report, and reporting
          // [Infinity, -Infinity] would make a legend label nonsense
          attributeRanges[name] = { min, max }
        }
      }
      return { attributes, attributeRanges }
    },
  }
}
