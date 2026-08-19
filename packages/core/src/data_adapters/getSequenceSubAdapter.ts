import type { BaseAdapter, BaseSequenceAdapter } from './BaseAdapter/index.ts'

/**
 * Resolves the reference sequence an adapter reads from.
 *
 * **The assembly is the source, and a hand-written `sequenceAdapter` slot is an
 * anti-pattern.** `getFeatureAdapter` and `CoreGetRefNames` prime every feature
 * adapter's `sequenceAdapterConfig` from the assembly the track is displayed
 * against, so no config has to copy a sequence adapter into a track. The slot
 * survives as an escape hatch for reading some *other* sequence, and setting it
 * pins the track to that source even when the assembly's own sequence changes —
 * so it wins only when explicitly present, and `jbrowse validate` warns about it.
 *
 * In core rather than beside one of its callers because the field it reads is
 * `BaseAdapter`'s. Deliberately NOT in `BaseAdapter/index.ts`: that barrel is a
 * `@jbrowse/core/*` re-export, and a name published there can only be removed
 * through `KNOWN_REMOVALS`.
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
