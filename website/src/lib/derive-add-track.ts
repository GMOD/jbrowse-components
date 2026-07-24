// Derive the `jbrowse add-track` command equivalent to a track config object.
//
// Only "CLI-clean" configs are derivable: a single-file `uri` adapter with no
// extra adapter slots, no custom displays, and no other top-level track slots.
// add-track's `--config` is a *shallow* top-level merge (see
// products/jbrowse-cli `buildTrackConfig`), so it cannot faithfully add adapter
// slots or displays without replacing the whole adapter — anything richer than
// clean keeps its JSON and gets no CLI tab. deriveAddTrack returns null for
// those, and the check script round-trips every emitted command through the
// real CLI so a wrong derivation fails the build rather than shipping.

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

// Quote a flag value for a POSIX shell only when it carries a shell-significant
// character; plain tokens (ids, URLs, comma lists) stay bare so the common
// command reads cleanly.
function shellArg(value: string) {
  return /^[A-Za-z0-9_./:,=@+-]+$/.test(value)
    ? value
    : `"${value.replace(/(["\\$`])/g, '\\$1')}"`
}

function asStringArray(value: unknown) {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
    ? (value as string[])
    : undefined
}

export function deriveAddTrack(config: unknown): string | null {
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
    type: _trackType,
    ...restTop
  } = track ?? {}
  const adapterObj =
    adapter && typeof adapter === 'object'
      ? (adapter as Record<string, unknown>)
      : undefined
  const { type: adapterType, uri, baseUri: _baseUri, ...adapterExtra } =
    adapterObj ?? {}
  const asm = asStringArray(assemblyNames)

  const isClean =
    adapterObj !== undefined &&
    typeof adapterType === 'string' &&
    typeof uri === 'string' &&
    uri.length > 0 &&
    Object.keys(adapterExtra).length === 0 &&
    displays === undefined &&
    Object.keys(restTop).length === 0 &&
    typeof trackId === 'string' &&
    typeof name === 'string' &&
    asm !== undefined &&
    asm.length > 0

  return isClean
    ? [
        `jbrowse add-track ${shellArg(uri as string)}`,
        `--trackId ${shellArg(trackId as string)}`,
        `--name ${shellArg(name as string)}`,
        `--assemblyNames ${shellArg((asm as string[]).join(','))}`,
        ...(inferredAdapterType(uri as string) === adapterType
          ? []
          : [`--adapterType ${shellArg(adapterType as string)}`]),
        ...(asStringArray(category)?.length
          ? [`--category ${shellArg(asStringArray(category)!.join(','))}`]
          : []),
        // local paths need --load; URLs are referenced in place
        ...(/^\w+:\/\//.test(uri as string) ? [] : ['--load copy']),
      ].join(' \\\n  ')
    : null
}
