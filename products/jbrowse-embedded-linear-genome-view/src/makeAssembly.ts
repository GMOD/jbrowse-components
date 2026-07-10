export interface MakeAssemblyOptions {
  /** URL to a FASTA (`.fa`/`.fasta`, optionally bgzipped) or a `.2bit` file */
  fastaUri: string
  /** defaults to the file's base name, e.g. `hg38.fa.gz` -> `hg38` */
  name?: string
  faiUri?: string
  gziUri?: string
  aliases?: string[]
  refNameAliasesUri?: string
}

// sequence extensions core's own guesser recognizes (plugins/sequence)
const SEQUENCE_EXT_RE = /\.(fa|fasta|fas|fna|mfa|2bit)(\.b?gz)?$/i

function cleanUri(uri: string) {
  return uri.split(/[?#]/)[0] ?? uri
}

/** true when a string names a sequence file (vs. a hub name like `hg38`) */
export function isSequenceUri(uri: string) {
  return SEQUENCE_EXT_RE.test(cleanUri(uri))
}

/** strip path and sequence extension: `.../hg19.fa.gz` -> `hg19` */
export function assemblyNameFromUri(uri: string) {
  const file = cleanUri(uri).split('/').at(-1) ?? uri
  return file.replace(SEQUENCE_EXT_RE, '')
}

/**
 * Build an assembly config for a sequence file (indexed FASTA, bgzipped FASTA,
 * or `.2bit`) — the boilerplate you'd otherwise write by hand. The adapter is a
 * bare `uri` shorthand: jbrowse-core's assembly config picks the concrete
 * adapter type (`IndexedFastaAdapter`/`BgzipFastaAdapter`/`TwoBitAdapter`) from
 * the extension and derives the `.fai`/`.gzi` siblings at load time, so no
 * adapter-type knowledge lives here. A non-sibling index (`faiUri`/`gziUri`)
 * overrides those derived locations. `refNameAliasesUri` points at a
 * tab-separated aliases file (as UCSC publishes) so a track whose reference
 * names differ from the sequence (e.g. a BAM using `chr1` against a `1`-named
 * reference) still lines up.
 */
export function makeAssembly(opts: MakeAssemblyOptions) {
  const {
    fastaUri,
    name = assemblyNameFromUri(fastaUri),
    faiUri,
    gziUri,
    aliases = [],
    refNameAliasesUri,
  } = opts
  return {
    name,
    aliases,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ReferenceSequenceTrack`,
      adapter: {
        uri: fastaUri,
        ...(faiUri ? { faiLocation: { uri: faiUri } } : {}),
        ...(gziUri ? { gziLocation: { uri: gziUri } } : {}),
      },
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
