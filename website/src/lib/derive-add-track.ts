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
import {
  expandTrackShorthand,
  guessAdapterType,
  guessTrackType,
  isLooseTrackConfig,
  syntenyAdapterTypes,
} from './infer-track.ts'

export { asRecord }

// The `add-track` argv (without the `jbrowse` program name) equivalent to a
// track config, or null when the config isn't CLI-clean. Returning the argv
// array rather than a shell string lets the check script run the real CLI
// without re-parsing quoting.
export function deriveAddTrackArgs(config: unknown): string[] | null {
  const source = asRecord(config)
  const loose = isLooseTrackConfig(source)
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
  } = expandTrackShorthand(source)
  // `baseUri` is deliberately *not* pulled out here: add-track emits a bare
  // UriLocation, so a config carrying one isn't CLI-clean. It counts as an
  // extra slot and falls through to the verbatim add-track-json tab. A
  // shorthand's adapter is the table's guess, which add-track writes itself.
  const {
    type: adapterType,
    uri,
    assemblyNames: adapterAssemblies,
    bed1,
    bed2,
    ...adapterExtra
  } = loose
    ? {
        type: asRecord(adapter).type,
        uri: source.uri,
        ...(source.baseUri === undefined ? {} : { baseUri: source.baseUri }),
      }
    : asRecord(adapter)
  const index = loose ? nonEmpty(source.index) : undefined
  const defaults = asRecord(displayDefaults)

  const id = nonEmpty(trackId)
  const label = nonEmpty(name)
  const type = nonEmpty(trackType)
  const file = nonEmpty(uri)
  const adapterName = nonEmpty(adapterType)
  const assemblies = commaList(assemblyNames)
  // add-track can only place the data file for a recognized extension
  const guessedAdapter = file && guessAdapterType(file)
  // the CLI derives a synteny adapter's own assemblyNames from -a, so that slot
  // is derivable exactly when it repeats the track's list; anything else (an
  // assemblyNameToPanSN map, a differing list) is an extra slot
  const derivableAssemblies =
    adapterAssemblies === undefined ||
    (adapterName !== undefined &&
      syntenyAdapterTypes.has(adapterName) &&
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
        ...flag('--indexFile', index),
        ...flag(
          '--adapterType',
          guessedAdapter === adapterName ? undefined : adapterName,
        ),
        ...flag(
          '--trackType',
          guessTrackType(adapterName, file) === type ? undefined : type,
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
