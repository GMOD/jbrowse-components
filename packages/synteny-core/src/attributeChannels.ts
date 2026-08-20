import type { AttributeRange } from './colorRamps.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The numeric per-feature channels a continuous color-by mode can paint.
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
 */
export const PRESET_ATTRIBUTES = [
  'identity',
  'meanIdentity',
  'mappingQual',
  'dnds',
] as const

// `attributeColumns` is the MCScanBlocksAdapter slot naming an ortholog table's
// measurement columns. Read straight off the adapter config the worker was
// handed: it is a declared, bounded list, and reaching for it here means no
// extra RPC argument to thread from the display and keep in sync.
export function declaredAttributes(adapterConfig: Record<string, unknown>) {
  const declared = adapterConfig.attributeColumns
  return Array.isArray(declared)
    ? declared.filter(x => typeof x === 'string')
    : []
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

/**
 * Allocate one Float32Array per channel, fill it as features are visited, and
 * report the span each one actually covered.
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
  }))
  return {
    /** The resolved channels, in declaration order — what the hot loop walks. */
    list,
    /** Truncate to the features actually kept, and close out the ranges. */
    finish(validCount: number) {
      const attributes: Record<string, Float32Array> = {}
      const attributeRanges: Record<string, AttributeRange> = {}
      for (const { name, array, min, max } of list) {
        attributes[name] = array.subarray(0, validCount)
        // an attribute nothing carried has no range to report, and reporting
        // [Infinity, -Infinity] would make a legend label nonsense
        if (Number.isFinite(min)) {
          attributeRanges[name] = { min, max }
        }
      }
      return { attributes, attributeRanges }
    },
  }
}
