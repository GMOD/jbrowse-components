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

function asStringArray(value: unknown) {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
    ? (value as string[])
    : undefined
}

// The `add-track` argv (without the `jbrowse` program name) equivalent to a
// track config, or null when the config isn't CLI-clean. Returning the argv
// array rather than a shell string lets the check script run the real CLI
// without re-parsing quoting.
export function deriveAddTrackArgs(config: unknown): string[] | null {
  const track =
    config && typeof config === 'object'
      ? (config as Record<string, unknown>)
      : undefined
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
  } = track ?? {}
  const hasDisplayDefaults =
    displayDefaults !== undefined &&
    typeof displayDefaults === 'object' &&
    displayDefaults !== null &&
    Object.keys(displayDefaults).length > 0
  const adapterObj =
    adapter && typeof adapter === 'object'
      ? (adapter as Record<string, unknown>)
      : undefined
  const { type: adapterType, uri, baseUri: _baseUri, ...adapterExtra } =
    adapterObj ?? {}
  const asm = asStringArray(assemblyNames)
  const cats = asStringArray(category)

  const isClean =
    adapterObj !== undefined &&
    typeof adapterType === 'string' &&
    typeof uri === 'string' &&
    uri.length > 0 &&
    // add-track can only place the data file for a recognized extension; an
    // unknown one (e.g. .ld.gz) yields an adapter with no location
    inferredAdapterType(uri) !== undefined &&
    Object.keys(adapterExtra).length === 0 &&
    displays === undefined &&
    Object.keys(restTop).length === 0 &&
    typeof trackId === 'string' &&
    typeof name === 'string' &&
    typeof trackType === 'string' &&
    asm !== undefined &&
    asm.length > 0

  return isClean
    ? [
        'add-track',
        uri as string,
        '--trackId',
        trackId as string,
        '--name',
        name as string,
        '--assemblyNames',
        (asm as string[]).join(','),
        ...(inferredAdapterType(uri as string) === adapterType
          ? []
          : ['--adapterType', adapterType as string]),
        ...(inferredTrackType(adapterType as string) === trackType
          ? []
          : ['--trackType', trackType as string]),
        ...(cats?.length ? ['--category', cats.join(',')] : []),
        ...(hasDisplayDefaults
          ? ['--displayDefaults', JSON.stringify(displayDefaults)]
          : []),
        // local paths need --load; URLs are referenced in place
        ...(/^\w+:\/\//.test(uri as string) ? [] : ['--load', 'copy']),
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
  const [subcommand, uri, ...rest] = args
  const lines = [`jbrowse ${subcommand} ${shellArg(uri!)}`]
  for (let i = 0; i < rest.length; i += 2) {
    lines.push(`${rest[i]} ${shellArg(rest[i + 1]!)}`)
  }
  return lines.join(' \\\n  ')
}

export function deriveAddTrack(config: unknown): string | null {
  const args = deriveAddTrackArgs(config)
  return args === null ? null : formatCommand(args)
}
