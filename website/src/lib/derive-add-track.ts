// Derive the `jbrowse add-track` command equivalent to a track config object.
//
// Only "CLI-clean" configs are derivable: a single-file `uri` adapter whose only
// other slots are ones a flag covers (`bed1`/`bed2`, a synteny adapter's own
// `assemblyNames`), no custom displays, and no other top-level track slots.
// add-track's `--config` is a *shallow* top-level merge (see
// products/jbrowse-cli `buildTrackConfig`), so it cannot faithfully add adapter
// slots or displays without replacing the whole adapter — anything richer than
// clean keeps its JSON and gets no CLI tab. deriveAddTrackArgs returns null for
// those, and scripts/check-config-cli.ts round-trips every emitted command
// through the real CLI so a wrong derivation fails the build rather than
// shipping.

import {
  asRecord,
  commaList,
  flag,
  formatCommand,
  loadFlag,
  nonEmpty,
} from './derive-cli-command.ts'

export { asRecord }

// extension -> adapterType, mirroring guessAdapterFromFileName in
// products/jbrowse-cli/src/commands/add-track-utils/adapter-utils.ts. Kept to
// the formats the docs actually use; an unmatched extension just forces an
// explicit --adapterType, which is always correct.
const EXT_ADAPTER: [RegExp, string][] = [
  [/\.bam$/i, 'BamAdapter'],
  [/\.cram$/i, 'CramAdapter'],
  [/\.gff3?\.b?gz$/i, 'Gff3TabixAdapter'],
  [/\.gtf?\.b?gz$/i, 'GtfTabixAdapter'],
  [/\.vcf\.b?gz$/i, 'VcfTabixAdapter'],
  [/\.bed\.b?gz$/i, 'BedTabixAdapter'],
  [/\.(bw|bigwig)$/i, 'BigWigAdapter'],
  [/\.(bb|bigbed)$/i, 'BigBedAdapter'],
  [/\.hic$/i, 'HicAdapter'],
  // the synteny family, longest extension first so .anchors.simple isn't read
  // as .anchors. An all-vs-all adapter over one of these files is reached with
  // --adapterType: the CLI reuses the extension's file layout under the given
  // type name rather than dropping the location.
  [/\.pif\.b?gz$/i, 'PairwiseIndexedPAFAdapter'],
  [/\.paf(\.gz)?$/i, 'PAFAdapter'],
  [/\.anchors\.simple(\.gz)?$/i, 'MCScanSimpleAnchorsAdapter'],
  [/\.anchors(\.gz)?$/i, 'MCScanAnchorsAdapter'],
  [/\.chain(\.gz)?$/i, 'ChainAdapter'],
  [/\.delta(\.gz)?$/i, 'DeltaAdapter'],
]

function inferredAdapterType(uri: string) {
  return EXT_ADAPTER.find(([re]) => re.test(uri))?.[1]
}

// adapterType -> trackType, mirroring adapterTypesToTrackTypeMap /
// guessTrackType in the same CLI source. Anything unlisted resolves to
// FeatureTrack, so add-track needs an explicit --trackType whenever the config
// declares a different type over that adapter (a bed.gz served as a
// MultiQuantitativeTrack, a GWASAdapter as a GWASTrack, ...).
const ADAPTER_TRACK_TYPE: Record<string, string> = {
  BamAdapter: 'AlignmentsTrack',
  CramAdapter: 'AlignmentsTrack',
  BigWigAdapter: 'QuantitativeTrack',
  VcfTabixAdapter: 'VariantTrack',
  VcfAdapter: 'VariantTrack',
  BedpeAdapter: 'VariantTrack',
  BedAdapter: 'FeatureTrack',
  HicAdapter: 'HicTrack',
  PAFAdapter: 'SyntenyTrack',
  PairwiseIndexedPAFAdapter: 'SyntenyTrack',
  AllVsAllPAFAdapter: 'SyntenyTrack',
  AllVsAllIndexedPAFAdapter: 'SyntenyTrack',
  ChainAdapter: 'SyntenyTrack',
  DeltaAdapter: 'SyntenyTrack',
  MashMapAdapter: 'SyntenyTrack',
  BlastTabularAdapter: 'SyntenyTrack',
  MCScanAnchorsAdapter: 'SyntenyTrack',
  MCScanSimpleAnchorsAdapter: 'SyntenyTrack',
  MCScanBlocksAdapter: 'SyntenyTrack',
}

// add-track writes `assemblyNames` onto the adapter itself for every adapter
// that resolves to a SyntenyTrack (addSyntenyAssemblyNames in the CLI), taking
// them from -a. Such an adapter slot is therefore derivable rather than an
// extra, but only when it matches the track's own list.
const SYNTENY_ADAPTERS = new Set(
  Object.entries(ADAPTER_TRACK_TYPE)
    .filter(([, trackType]) => trackType === 'SyntenyTrack')
    .map(([adapterType]) => adapterType),
)

function inferredTrackType(adapterType: string) {
  return ADAPTER_TRACK_TYPE[adapterType] ?? 'FeatureTrack'
}

// The `add-track` argv (without the `jbrowse` program name) equivalent to a
// track config, or null when the config isn't CLI-clean. Returning the argv
// array rather than a shell string lets the check script run the real CLI
// without re-parsing quoting.
export function deriveAddTrackArgs(config: unknown): string[] | null {
  const {
    trackId,
    name,
    assemblyNames,
    category,
    adapter,
    displays,
    displayDefaults,
    type: trackType,
    ...restTop
  } = asRecord(config)
  // `baseUri` is deliberately *not* pulled out here: add-track emits a bare
  // UriLocation, so a config carrying one isn't CLI-clean. It counts as an
  // extra adapter slot and falls through to the verbatim add-track-json tab.
  const {
    type: adapterType,
    uri,
    assemblyNames: adapterAssemblies,
    bed1,
    bed2,
    ...adapterExtra
  } = asRecord(adapter)
  const defaults = asRecord(displayDefaults)

  const id = nonEmpty(trackId)
  const label = nonEmpty(name)
  const type = nonEmpty(trackType)
  const file = nonEmpty(uri)
  const adapterName = nonEmpty(adapterType)
  const assemblies = commaList(assemblyNames)
  // add-track can only place the data file for a recognized extension; an
  // unknown one (e.g. .ld.gz) yields an adapter with no location
  const guessedAdapter = file && inferredAdapterType(file)
  // the CLI derives a synteny adapter's own assemblyNames from -a, so that slot
  // is derivable exactly when it repeats the track's list; anything else (an
  // assemblyNameToPanSN map, a differing list) is an extra slot
  const derivableAssemblies =
    adapterAssemblies === undefined ||
    (adapterName !== undefined &&
      SYNTENY_ADAPTERS.has(adapterName) &&
      commaList(adapterAssemblies) === assemblies)
  const noExtraSlots =
    displays === undefined &&
    derivableAssemblies &&
    Object.keys(adapterExtra).length === 0 &&
    Object.keys(restTop).length === 0

  return id &&
    label &&
    type &&
    file &&
    adapterName &&
    assemblies &&
    guessedAdapter &&
    noExtraSlots
    ? [
        'add-track',
        file,
        '--trackId',
        id,
        '--name',
        label,
        '--assemblyNames',
        assemblies,
        ...flag(
          '--adapterType',
          guessedAdapter === adapterName ? undefined : adapterName,
        ),
        ...flag(
          '--trackType',
          inferredTrackType(adapterName) === type ? undefined : type,
        ),
        ...flag('--category', commaList(category)),
        // the MCScan adapters pair genes by name, so each takes a BED per
        // genome alongside the anchors file
        ...flag('--bed1', nonEmpty(bed1)),
        ...flag('--bed2', nonEmpty(bed2)),
        ...flag(
          '--displayDefaults',
          Object.keys(defaults).length > 0
            ? JSON.stringify(defaults)
            : undefined,
        ),
        ...loadFlag(file),
      ]
    : null
}

export function deriveAddTrack(config: unknown): string | null {
  const args = deriveAddTrackArgs(config)
  return args === null ? null : formatCommand(args)
}

// Fallback for a config `deriveAddTrack` refuses (multi-file adapter, custom
// `displays`, ...): `add-track-json` takes a track config verbatim, so it
// never needs to refuse one. Embeds the block's own source text rather than
// re-serializing the parsed object, so the command can't drift from the JSON
// shown beside it.
export function deriveAddTrackJson(rawJson: string): string {
  return `jbrowse add-track-json '${rawJson.replaceAll("'", String.raw`'\''`)}'`
}
