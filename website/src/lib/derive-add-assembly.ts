// Derive the `jbrowse add-assembly` command equivalent to an assembly config
// object, the counterpart to derive-add-track.ts.
//
// Unlike tracks there is no `add-assembly-json` fallback (`--type custom` takes
// a *sequence adapter*, not a whole assembly), so a config this refuses gets no
// CLI tab at all, and scripts/check-config-cli.ts fails on an `addassembly`
// block it cannot derive rather than letting the doc ship a tab-less widget.
// Fields with no dedicated flag ride along in `--config`, which add-assembly
// merges into the generated assembly, so `geneticCodes`/`cytobands`-style slots
// are still derivable.

import {
  asRecord,
  commaList,
  flag,
  formatCommand,
  loadFlag,
  nonEmpty,
  repeatedFlag,
} from './derive-cli-command.ts'

// sequence adapter type -> the CLI's --type value, mirroring seqSpecs in
// products/jbrowse-cli/src/commands/add-assembly/utils.ts. An adapter absent
// from this map (UnindexedFastaAdapter, a FromConfig sequence) has no
// add-assembly file layout, so the config isn't derivable.
const ADAPTER_SEQUENCE_TYPE: Record<string, string> = {
  IndexedFastaAdapter: 'indexedFasta',
  BgzipFastaAdapter: 'bgzipFasta',
  TwoBitAdapter: 'twoBit',
  ChromSizesAdapter: 'chromSizes',
}

// extension -> --type, mirroring guessSequenceType in the same CLI source, so
// --type is emitted only when the extension doesn't already imply the adapter
const EXT_SEQUENCE_TYPE: [RegExp, string][] = [
  [/\.(fa|fna|fasta|mfa)\.gz$/i, 'bgzipFasta'],
  [/\.(fa|fna|fasta|mfa)$/i, 'indexedFasta'],
  [/\.2bit$/i, 'twoBit'],
  [/\.chrom\.sizes$/i, 'chromSizes'],
]

function inferredSequenceType(uri: string) {
  return EXT_SEQUENCE_TYPE.find(([re]) => re.test(uri))?.[1]
}

// `--refNameAliases <file>` writes a RefNameAliasAdapter over that file, so an
// aliases slot is derivable when it is a plain uri shorthand or that adapter
// over one. A custom alias adapter (NcbiSequenceReportAliasAdapter) needs
// `--refNameAliasesType custom` with inline JSON, and is left undrivable.
export function aliasesUri(refNameAliases: unknown) {
  const slot = asRecord(refNameAliases)
  const adapter = asRecord(slot.adapter)
  return (
    nonEmpty(slot.uri) ??
    (adapter.type === undefined || adapter.type === 'RefNameAliasAdapter'
      ? (nonEmpty(adapter.uri) ?? nonEmpty(asRecord(adapter.location).uri))
      : undefined)
  )
}

// The `add-assembly` argv (without the `jbrowse` program name) equivalent to an
// assembly config, or null when the config isn't derivable.
export function deriveAddAssemblyArgs(config: unknown): string[] | null {
  const {
    name,
    uri,
    aliases,
    displayName,
    refNameColors,
    refNameAliases,
    sequence,
    ...restTop
  } = asRecord(config)
  const { type: sequenceTrackType, trackId, adapter, ...seqExtra } = asRecord(
    sequence,
  )
  const { type: adapterType, uri: adapterUri, ...adapterExtra } =
    asRecord(adapter)

  const assemblyName = nonEmpty(name)
  // either shorthand: a top-level `uri` on the assembly, or
  // `sequence.adapter.uri`. The legacy `fastaLocation`/`twoBitLocation` forms
  // are deliberately not read: add-assembly derives those sidecar paths itself,
  // so a config spelling them out is not what any flag set reproduces.
  const file = nonEmpty(uri) ?? nonEmpty(adapterUri)
  // add-assembly always writes these two, so a config naming them differently
  // is not what the derived command would produce
  const boilerplateSequence =
    (sequenceTrackType === undefined ||
      sequenceTrackType === 'ReferenceSequenceTrack') &&
    (trackId === undefined ||
      trackId === `${assemblyName}-ReferenceSequenceTrack`) &&
    Object.keys(seqExtra).length === 0 &&
    Object.keys(adapterExtra).length === 0
  const declaredType = nonEmpty(adapterType)
  const sequenceType = declaredType
    ? ADAPTER_SEQUENCE_TYPE[declaredType]
    : file && inferredSequenceType(file)
  const aliasesFile = aliasesUri(refNameAliases)
  const aliasesDerivable = refNameAliases === undefined || Boolean(aliasesFile)

  return assemblyName &&
    file &&
    sequenceType &&
    boilerplateSequence &&
    aliasesDerivable
    ? [
        'add-assembly',
        file,
        '--name',
        assemblyName,
        ...flag(
          '--type',
          inferredSequenceType(file) === sequenceType
            ? undefined
            : sequenceType,
        ),
        ...repeatedFlag('--alias', aliases),
        ...flag('--displayName', nonEmpty(displayName)),
        ...flag('--refNameColors', commaList(refNameColors)),
        ...flag('--refNameAliases', aliasesFile),
        // every remaining top-level slot (geneticCodes, cytobands, ...) is
        // merged in by --config, which add-assembly takes as inline JSON
        ...flag(
          '--config',
          Object.keys(restTop).length > 0 ? JSON.stringify(restTop) : undefined,
        ),
        ...loadFlag(file),
      ]
    : null
}

export function deriveAddAssembly(config: unknown): string | null {
  const args = deriveAddAssemblyArgs(config)
  return args === null ? null : formatCommand(args)
}
