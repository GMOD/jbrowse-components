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
  const unique = [...new Set(names)]
  const arrays = Object.fromEntries(
    unique.map(name => [name, new Float32Array(count)]),
  )
  const lo = new Map(unique.map(name => [name, Number.POSITIVE_INFINITY]))
  const hi = new Map(unique.map(name => [name, Number.NEGATIVE_INFINITY]))
  return {
    arrays,
    write(index: number, name: string, value: number) {
      const array = arrays[name]
      if (array) {
        array[index] = value
        if (value >= 0) {
          lo.set(name, Math.min(lo.get(name)!, value))
          hi.set(name, Math.max(hi.get(name)!, value))
        }
      }
    },
    /** Read `name` off a feature as a number, -1 for anything that is not one. */
    read(feature: Feature, name: string) {
      const value = feature.get(name)
      return typeof value === 'number' && Number.isFinite(value) ? value : -1
    },
    /** Truncate to the features actually kept, and close out the ranges. */
    finish(validCount: number) {
      const attributes: Record<string, Float32Array> = {}
      const attributeRanges: Record<string, AttributeRange> = {}
      for (const name of unique) {
        attributes[name] = arrays[name]!.subarray(0, validCount)
        const min = lo.get(name)!
        // an attribute nothing carried has no range to report, and reporting
        // [Infinity, -Infinity] would make a legend label nonsense
        if (Number.isFinite(min)) {
          attributeRanges[name] = { min, max: hi.get(name)! }
        }
      }
      return { attributes, attributeRanges }
    },
  }
}
