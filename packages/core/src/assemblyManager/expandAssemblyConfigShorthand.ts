import { UNKNOWN } from '../util/tracks.ts'

import type PluginManager from '../PluginManager.ts'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Fill in an assembly `sequence.adapter`'s `type` from its `uri` when the type
 * is omitted, so `sequence: { adapter: { uri: 'genome.fa.gz' } }` resolves to a
 * `BgzipFastaAdapter` (and `.fa` → indexed, `.2bit` → `TwoBitAdapter`). Uses the
 * same `Core-guessAdapterForLocation` extension point the "Add track" flow uses,
 * so every host describes a custom genome with just a URL and lets jbrowse-core
 * pick the adapter — no adapter-type table in the Python/R/JS bindings.
 *
 * The guesser also derives the index locations (`.fai`/`.gzi`) from the uri;
 * explicit adapter fields (e.g. a non-sibling `faiLocation`) are spread on top
 * so they win. A `uri` matching no sequence adapter is left untouched, so a
 * genuinely bad config still surfaces its own downstream error. Returns the same
 * object reference when there is nothing to expand, so callers can cheaply skip
 * a rebuild.
 */
/**
 * Expand an assembly snapshot's own shorthands into the `sequence` an assembly
 * config declares: the flat `{ name, uri: 'genome.fa.gz' }` form, the
 * `sequence: { adapter: { uri } }` form, and the omitted
 * `sequence.type`/`trackId`.
 *
 * This is the assembly config schema's `preProcessSnapshot`, lifted out so a
 * caller that has to see canonical locations *before* MST builds the tree can
 * run it too. `localFiles` is that caller: it rewrites `{ uri: <a registered
 * name> }` location nodes into blobs, and until this has run the only `uri` in
 * a shorthand assembly is on the assembly itself, where it is not a location
 * node and must not be rewritten as one. Idempotent — the flat `uri` is
 * consumed, so the schema's own later pass finds nothing to do.
 */
export function expandAssemblyShorthand<T>(
  snap: T,
  pluginManager: PluginManager,
): T {
  if (!isPlainObject(snap)) {
    return snap
  }
  const { name, uri, baseUri, ...rest } = snap
  // flattest shorthand: `{ name, uri: 'genome.fa.gz' }` describes an
  // assembly by its sequence file alone. baseUri, stamped next to the
  // `uri` key by addRelativeUris (hub/relative configs), rides down onto
  // the adapter so the sequence resolves against the config's location.
  const rawSequence =
    rest.sequence ??
    (typeof uri === 'string'
      ? { adapter: { uri, ...(baseUri ? { baseUri } : {}) } }
      : undefined)
  // infer sequence.adapter.type from its uri when omitted, so a config can
  // give just `sequence: { adapter: { uri: 'genome.fa.gz' } }` and core
  // picks the adapter (Bgzip/Indexed/TwoBit) — no adapter table in hosts
  const seq = expandAssemblySequenceAdapter(rawSequence, pluginManager)
  // then allow sequence.type/trackId to be omitted, since they are always
  // 'ReferenceSequenceTrack' and a name derived from the assembly name
  const sequence =
    seq && typeof seq === 'object' && !('type' in seq)
      ? {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          ...seq,
        }
      : seq
  // preserve the identity-unchanged case so nothing rebuilds needlessly
  return (sequence === snap.sequence ? snap : { ...rest, name, sequence }) as T
}

export function expandAssemblySequenceAdapter(
  sequence: unknown,
  pluginManager: PluginManager,
): unknown {
  const adapter = isPlainObject(sequence) ? sequence.adapter : undefined
  if (
    isPlainObject(sequence) &&
    isPlainObject(adapter) &&
    !('type' in adapter) &&
    typeof adapter.uri === 'string'
  ) {
    const { uri, baseUri, ...extras } = adapter
    const guesser = pluginManager.evaluateExtensionPoint(
      'Core-guessAdapterForLocation',
      () => undefined,
    )
    // baseUri (stamped next to `uri` by addRelativeUris for hub/relative configs)
    // rides on the file location so the guessed fastaLocation and its derived
    // .fai/.gzi siblings all resolve against the config's own location
    const file = {
      uri,
      locationType: 'UriLocation' as const,
      ...(typeof baseUri === 'string' ? { baseUri } : {}),
    }
    const guess = guesser(file, undefined)
    return guess && guess.type !== UNKNOWN
      ? { ...sequence, adapter: { ...guess, ...extras } }
      : sequence
  }
  return sequence
}
