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
