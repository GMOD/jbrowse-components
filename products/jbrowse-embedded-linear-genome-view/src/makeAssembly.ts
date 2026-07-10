export interface MakeAssemblyOptions {
  name: string
  fastaUri: string
  faiUri?: string
  gziUri?: string
  aliases?: string[]
  refNameAliasesUri?: string
}

/**
 * Build an assembly config for an (optionally bgzipped) indexed FASTA — the
 * boilerplate you'd otherwise write by hand. `refNameAliasesUri` points at a
 * tab-separated aliases file (as UCSC publishes) so a track whose reference
 * names differ from the FASTA (e.g. a BAM using `chr1` against a `1`-named
 * reference) still lines up.
 */
export function makeAssembly(opts: MakeAssemblyOptions) {
  const {
    name,
    fastaUri,
    faiUri,
    gziUri,
    aliases = [],
    refNameAliasesUri,
  } = opts
  const bgzipped = fastaUri.endsWith('.gz')
  const adapter = {
    type: bgzipped ? 'BgzipFastaAdapter' : 'IndexedFastaAdapter',
    uri: fastaUri,
    faiLocation: { uri: faiUri ?? `${fastaUri}.fai` },
    ...(bgzipped ? { gziLocation: { uri: gziUri ?? `${fastaUri}.gzi` } } : {}),
  }
  return {
    name,
    aliases,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ReferenceSequenceTrack`,
      adapter,
    },
    ...(refNameAliasesUri
      ? {
          refNameAliases: {
            adapter: { type: 'RefNameAliasAdapter', uri: refNameAliasesUri },
          },
        }
      : {}),
  }
}
