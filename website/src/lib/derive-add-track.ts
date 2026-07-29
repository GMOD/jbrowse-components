// Derive the `jbrowse add-track` command equivalent to a track config object.
//
// Only "CLI-clean" configs are derivable: a single-file `uri` adapter with no
// extra adapter slots, no custom displays, and no other top-level track slots.
// add-track's `--config` is a *shallow* top-level merge (see
// products/jbrowse-cli `buildTrackConfig`), so it cannot faithfully add adapter
// slots or displays without replacing the whole adapter — anything richer than
// clean keeps its JSON and gets no CLI tab. deriveAddTrackArgs returns null for
// those, and scripts/check-config-cli.ts round-trips every emitted command
// through the real CLI so a wrong derivation fails the build rather than
// shipping.

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
  PairwiseIndexedPAFAdapter: 'SyntenyTrack',
}

function inferredTrackType(adapterType: string) {
  return ADAPTER_TRACK_TYPE[adapterType] ?? 'FeatureTrack'
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

// A non-empty string, or undefined — so callers can test presence by truthiness.
function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// A comma list for a repeatable flag, or undefined when there's nothing to pass.
function commaList(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty)
    ? value.join(',')
    : undefined
}

// `flag value` when `value` is set, nothing when it isn't.
function flag(name: string, value: string | undefined) {
  return value === undefined ? [] : [name, value]
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
  const { type: adapterType, uri, ...adapterExtra } = asRecord(adapter)
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
  const noExtraSlots =
    displays === undefined &&
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
        ...flag(
          '--displayDefaults',
          Object.keys(defaults).length > 0
            ? JSON.stringify(defaults)
            : undefined,
        ),
        // local paths need --load; URLs are referenced in place
        ...flag('--load', /^\w+:\/\//.test(file) ? undefined : 'copy'),
      ]
    : null
}

// Quote a token for a POSIX shell only when it carries a shell-significant
// character; plain tokens (ids, URLs, comma lists) stay bare.
function shellArg(value: string) {
  return /^[A-Za-z0-9_./:,=@+-]+$/.test(value)
    ? value
    : `"${value.replaceAll(/(["\\$`])/g, '\\$1')}"`
}

// Render the argv as a readable multi-line shell command: the positional file
// on the first line, then one `--flag value` pair per continued line.
function formatCommand(args: string[]) {
  const [subcommand = '', uri = '', ...flags] = args
  const pairs = flags.flatMap((token, i) =>
    i % 2 === 0 ? [`${token} ${shellArg(flags[i + 1] ?? '')}`] : [],
  )
  return [`jbrowse ${subcommand} ${shellArg(uri)}`, ...pairs].join(' \\\n  ')
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
