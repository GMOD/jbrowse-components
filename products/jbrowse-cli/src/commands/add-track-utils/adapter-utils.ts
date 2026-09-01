import fs from 'node:fs'

import {
  adapterTypesToTrackTypeMap,
  formats,
  matchFormat,
  resolveIndexType,
  trackTypeForAdapter,
} from '@jbrowse/add-track-core'

import { isURL } from '../../types/common.ts'
import { densitySidecarPath } from '../shared/density.ts'

import type { AdapterSpec } from '@jbrowse/add-track-core'

interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}

interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

export type Location = UriLocation | LocalPathLocation

export interface Adapter {
  type: string
  [key: string]: unknown
}

// the specs that carry a location field, keyed by adapter type, so an explicit
// --adapterType can be resolved back to its file-layout spec
type LocFieldSpec = Extract<AdapterSpec, { locField: string }>

function hasLocField(spec: AdapterSpec): spec is LocFieldSpec {
  return 'locField' in spec
}

const adapterTypeToSpec: Record<string, LocFieldSpec> = {}
for (const { spec } of formats) {
  if (hasLocField(spec) && !adapterTypeToSpec[spec.adapterType]) {
    adapterTypeToSpec[spec.adapterType] = spec
  }
}

// What else the sidecar with this suffix can be named. `.csi` is htslib's
// alternative for a BAI or a TBI — required for a reference over 512 Mb, and
// written on request at any size. `stripped` is the form Picard and GATK write:
// `reads.bai` beside `reads.bam`, where samtools writes `reads.bam.bai`.
//
// Per-suffix because the alternatives are: a `.crai` has no CSI form, and
// stripping the extension off `calls.vcf.gz` would name `calls.vcf.tbi`, which
// nothing writes. A `.fai`/`.gzi` has neither and so is absent here.
//
// This is `indexCandidateNames` in `@jbrowse/core/util/indexCandidates`, which
// the add-track widget and jbrowse-img share and this CLI cannot import — it
// carries no `@jbrowse/core` dependency, so `npm i -g @jbrowse/cli` stays a CLI
// rather than a copy of the app. Change one, change the other.
const ALTERNATE_SPELLINGS: Record<
  string,
  { csi?: boolean; stripped?: boolean }
> = {
  '.bai': { csi: true, stripped: true },
  '.crai': { stripped: true },
  '.tbi': { csi: true },
}

/**
 * The sidecar actually sitting beside `location`, or the conventional name when
 * none of the spellings is there — so a missing index still reports the file
 * that was expected, and `--load` still names it.
 *
 * Probed with `existsSync`, which is false for every candidate of a URL and so
 * leaves a remote track with exactly the conventional guess it had before this
 * existed. A remote `.csi` still wants `--indexFile`.
 *
 * The guard on the stripped spelling is load-bearing: `replace` hands back the
 * subject unchanged when the pattern does not match, so `--adapterType
 * BamAdapter` on a file named with no extension at all would offer the data
 * file as its own index — and that file certainly exists.
 */
export function siblingSidecar(location: string, suffix: string) {
  const { csi, stripped } = ALTERNATE_SPELLINGS[suffix] ?? {}
  const strippedName = location.replace(/\.[^./\\]+$/, suffix)
  const candidates = [
    `${location}${suffix}`,
    ...(csi ? [`${location}.csi`] : []),
    ...(stripped && strippedName !== location ? [strippedName] : []),
  ]
  return candidates.find(c => fs.existsSync(c)) ?? candidates[0]!
}

// The feature adapters whose schema spreads
// `densityAdapterConfigSchemaFields`, so a `densityAdapter` written onto one
// resolves to a slot rather than being dropped. Change one, change the other.
const densityAdapterTypes = new Set([
  'BamAdapter',
  'CramAdapter',
  'HtsgetBamAdapter',
  'Gff3TabixAdapter',
  'GtfTabixAdapter',
  'BedTabixAdapter',
  'BigBedAdapter',
  'VcfTabixAdapter',
  'SplitVcfTabixAdapter',
])

/**
 * The adapter with its density sidecar attached, and the local file to load
 * beside the config when there is one.
 *
 * An explicit `--density` is taken as given, since a URL cannot be probed;
 * otherwise the conventional `<file>.density.bw` counts only when it is
 * actually there, the way `siblingSidecar` probes an index.
 */
export function withDensityAdapter({
  adapter,
  location,
  density,
  makeLocation,
}: {
  adapter: Adapter
  location?: string
  density?: string
  makeLocation: (l: string) => Location
}): { adapter: Adapter; file?: string } {
  const supported = densityAdapterTypes.has(adapter.type)
  if (density !== undefined && !supported) {
    throw new Error(
      `--density has no slot on ${adapter.type}. The adapters carrying a density sidecar are: ${[...densityAdapterTypes].join(', ')}`,
    )
  }
  const probed =
    location !== undefined && fs.existsSync(densitySidecarPath(location))
      ? densitySidecarPath(location)
      : undefined
  if (probed !== undefined && !supported) {
    console.warn(
      `Warning: ${probed} sits beside the track file but ${adapter.type} has no densityAdapter slot, so it is not attached. The adapters carrying one are indexed: bgzip and tabix the file, then add it.`,
    )
  }
  const file =
    density === undefined ? (supported ? probed : undefined) : density
  return file === undefined
    ? { adapter }
    : {
        adapter: {
          ...adapter,
          densityAdapter: {
            type: 'BigWigAdapter',
            bigWigLocation: makeLocation(file),
          },
        },
        file: isURL(file) ? undefined : file,
      }
}

interface SpecContext {
  location: string
  index?: string
  bed1?: string
  bed2?: string
  makeLocation: (l: string) => Location
}

// builds the adapter object and the list of source files for a spec in one
// place, so the config it writes and the files add-track copies can never drift
function buildFromSpec(
  spec: AdapterSpec,
  { location, index, bed1, bed2, makeLocation }: SpecContext,
): { adapter: Adapter; files: (string | undefined)[] } {
  switch (spec.kind) {
    case 'single':
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
        },
        files: [location],
      }
    case 'indexed': {
      const idx = index || siblingSidecar(location, spec.suffix)
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          index: {
            location: makeLocation(idx),
            // the type follows the file that was CHOSEN, not the one the user
            // typed, so a detected `.csi` is opened as one
            indexType: resolveIndexType(idx, spec.indexType),
          },
        },
        files: [location, idx],
      }
    }
    case 'sidecar': {
      const sidecars = spec.sidecars.map(s => ({
        field: s.field,
        path: s.fromIndex && index ? index : siblingSidecar(location, s.suffix),
      }))
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          ...Object.fromEntries(
            sidecars.map(s => [s.field, makeLocation(s.path)]),
          ),
        },
        files: [location, ...sidecars.map(s => s.path)],
      }
    }
    case 'anchors':
      return {
        adapter: {
          type: spec.adapterType,
          [spec.locField]: makeLocation(location),
          bed1Location: bed1 ? makeLocation(bed1) : undefined,
          bed2Location: bed2 ? makeLocation(bed2) : undefined,
        },
        files: [location, bed1, bed2],
      }
    case 'unsupported':
      return { adapter: { type: 'UNSUPPORTED' }, files: [] }
  }
}

export function makeLocationProtocol(protocol: string) {
  return (location: string): Location => {
    if (protocol === 'uri') {
      return { uri: location, locationType: 'UriLocation' }
    }
    if (protocol === 'localPath') {
      return { localPath: location, locationType: 'LocalPathLocation' }
    }
    throw new Error(`invalid protocol ${protocol}`)
  }
}

/**
 * The bare filename the format table matches against — the same thing
 * `@jbrowse/core`'s `getFileName` hands the guesser chain, so a path and a URL
 * with a presigned query string both reduce to what the regexes expect.
 */
export function fileNameOf(location: string) {
  return (
    location.replaceAll('\\', '/').split('/').at(-1)?.split(/[?#]/)[0] ?? ''
  )
}

// resolves the file-layout spec that both the adapter config and the copied
// file set derive from, honoring an explicit --adapterType. `typeOverride` is
// the label to stamp on the adapter when the extension's layout is reused under
// a different adapter type.
function resolveSpec(
  location: string,
  adapterType?: string,
): { spec?: AdapterSpec; typeOverride?: string } {
  const spec = matchFormat(fileNameOf(location))?.spec
  if (adapterType) {
    const known = adapterTypeToSpec[adapterType]
    if (known) {
      // explicit --adapterType resolves back to its known file layout
      return { spec: known }
    } else if (spec) {
      // unknown adapter type on a recognized extension: reuse that extension's
      // file layout (location field + any sidecar/index files) under the new
      // type name, so e.g. --adapterType MyPAFAdapter on a .paf keeps its
      // pafLocation instead of dropping the file. Override with --config if the
      // custom adapter uses a different field.
      return { spec, typeOverride: adapterType }
    } else {
      // custom adapter type on an unrecognized extension: no layout to reuse
      return { typeOverride: adapterType }
    }
  } else {
    return { spec }
  }
}

// derives the track adapter and the raw source files together from one spec, so
// the config written and the files add-track copies can never drift. mapLocation
// turns a raw source path into the location the adapter stores (relative path +
// protocol wrapper); the returned files stay raw for the copy step.
export function guessTrack({
  location,
  index,
  bed1,
  bed2,
  adapterType,
  mapLocation,
}: {
  location: string
  index?: string
  bed1?: string
  bed2?: string
  adapterType?: string
  mapLocation: (l: string) => Location
}): { adapter: Adapter; files: (string | undefined)[] } {
  const { spec, typeOverride } = resolveSpec(location, adapterType)
  if (spec) {
    const { adapter, files } = buildFromSpec(spec, {
      location,
      index,
      bed1,
      bed2,
      makeLocation: mapLocation,
    })
    return {
      adapter: typeOverride ? { ...adapter, type: typeOverride } : adapter,
      files,
    }
  }
  return { adapter: { type: typeOverride ?? 'UNKNOWN' }, files: [] }
}

export function guessTrackType(adapterType: string, location?: string): string {
  return (
    trackTypeForAdapter(adapterType, location && fileNameOf(location)) ||
    'FeatureTrack'
  )
}

// the synteny adapters are exactly those mapping to a SyntenyTrack, so derive
// the set instead of maintaining a second hand-written list that can drift
export const syntenyAdapterTypes = new Set(
  Object.entries(adapterTypesToTrackTypeMap)
    .filter(([, trackType]) => trackType === 'SyntenyTrack')
    .map(([adapterType]) => adapterType),
)
