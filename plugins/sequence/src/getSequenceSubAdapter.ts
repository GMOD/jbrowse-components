import type {
  BaseAdapter,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * Resolves the reference sequence a scan adapter reads from.
 *
 * The assembly is the normal source: the feature RPCs prime
 * `sequenceAdapterConfig` from the displayed track's assembly (see
 * getFeatureAdapter), which is what lets a scan track be declared without
 * copying a sequence adapter into it. The `sequenceAdapter` slot is a
 * discouraged escape hatch for scanning some *other* sequence — setting it pins
 * the track to that source even when the assembly's own sequence changes — so
 * it wins only when explicitly present.
 *
 * `configured` is passed in rather than read here so each adapter reads its own
 * slot through its own config type.
 */
export async function getSequenceSubAdapter(
  adapter: BaseAdapter,
  configured: unknown,
): Promise<BaseSequenceAdapter> {
  const config = configured ?? adapter.sequenceAdapterConfig
  if (!config) {
    throw new Error(
      'No sequence adapter available: either set the `sequenceAdapter` slot or display this track against an assembly that has one',
    )
  }
  const result = await adapter.getSubAdapter?.(config)
  if (!result) {
    throw new Error('Error getting subadapter')
  }
  // An assembly can be backed by an adapter that carries no residues at all
  // (ChromSizesAdapter defines refName lengths only), and auto-resolution makes
  // that reachable without anyone having named a sequence adapter. Check for the
  // method rather than casting blind, so this fails with the reason instead of
  // `getSequence is not a function` deep in a scan.
  const { dataAdapter } = result
  if (!isSequenceAdapter(dataAdapter)) {
    // named from the config, not `constructor.name`, which minifies to noise
    const { type } = config as { type?: unknown }
    throw new Error(
      `Cannot scan the reference: adapter "${String(type)}" provides no sequence`,
    )
  }
  return dataAdapter
}

function isSequenceAdapter(
  adapter: BaseAdapter,
): adapter is BaseAdapter & BaseSequenceAdapter {
  return (
    typeof (adapter as { getSequence?: unknown }).getSequence === 'function'
  )
}
