import { isLocalPathLocation, isUriLocation } from '@jbrowse/core/util/types'

import type { FileLocation } from '@jbrowse/core/util/types'

export const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'FastaAdapter',
  'TwoBitAdapter',
] as const

export type AdapterType = (typeof adapterTypes)[number]

export const adapterLabels: Record<AdapterType, string> = {
  IndexedFastaAdapter: 'FASTA with index (.fa + .fai)',
  BgzipFastaAdapter: 'Compressed FASTA (.fa.gz + .fai + .gzi)',
  FastaAdapter: 'FASTA (index will be generated)',
  TwoBitAdapter: '2bit file (.2bit)',
}

export interface FormState {
  adapterSelection: AdapterType
  assemblyName: string
  assemblyDisplayName: string
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
  refNameAliasesLocation: FileLocation
  cytobandsLocation: FileLocation
}

const blank = { uri: '' } as FileLocation

export function initialFormState(): FormState {
  return {
    adapterSelection: adapterTypes[0],
    assemblyName: '',
    assemblyDisplayName: '',
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
    refNameAliasesLocation: blank,
    cytobandsLocation: blank,
  }
}

export function applyPrimaryFile(
  state: FormState,
  location: FileLocation,
): FormState {
  const filename = getFilename(location)
  const detected = filename ? detectAdapterType(filename) : undefined
  const assemblyName =
    filename && !state.assemblyName
      ? getAssemblyNameFromFilename(filename)
      : state.assemblyName
  if (detected === 'TwoBitAdapter') {
    return {
      ...state,
      twoBitLocation: location,
      adapterSelection: 'TwoBitAdapter',
      assemblyName,
    }
  }
  const adapterSelection = detected ?? state.adapterSelection
  return {
    ...state,
    fastaLocation: location,
    adapterSelection,
    assemblyName,
    ...guessSidecarLocations(state, location, adapterSelection),
  }
}

// Prefill conventional .fai/.gzi sidecars sitting next to the chosen FASTA,
// leaving any field the user already set untouched. Spreading the source
// location carries over its baseUri/auth so the sidecars use the same access.
function guessSidecarLocations(
  state: FormState,
  location: FileLocation,
  adapterSelection: AdapterType,
): Partial<FormState> {
  const wantsFai =
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  const wantsGzi = adapterSelection === 'BgzipFastaAdapter'
  const fai =
    wantsFai && isBlank(state.faiLocation)
      ? sidecar(location, '.fai')
      : undefined
  const gzi =
    wantsGzi && isBlank(state.gziLocation)
      ? sidecar(location, '.gzi')
      : undefined
  return {
    ...(fai ? { faiLocation: fai } : {}),
    ...(gzi ? { gziLocation: gzi } : {}),
  }
}

function sidecar(
  location: FileLocation,
  ext: string,
): FileLocation | undefined {
  if (isUriLocation(location)) {
    return { ...location, uri: `${location.uri}${ext}` }
  }
  if (isLocalPathLocation(location)) {
    return { ...location, localPath: `${location.localPath}${ext}` }
  }
  return undefined
}

export function applyTwoBitFile(
  state: FormState,
  location: FileLocation,
): FormState {
  const filename = getFilename(location)
  const assemblyName =
    filename && !state.assemblyName
      ? getAssemblyNameFromFilename(filename)
      : state.assemblyName
  return { ...state, twoBitLocation: location, assemblyName }
}

export function clearFormFields(state: FormState): FormState {
  return {
    ...state,
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
    refNameAliasesLocation: blank,
    cytobandsLocation: blank,
    assemblyName: '',
    assemblyDisplayName: '',
  }
}

export function getBaseAssemblyConfig(state: FormState) {
  return {
    name: state.assemblyName,
    ...(state.assemblyDisplayName
      ? { displayName: state.assemblyDisplayName }
      : {}),
    ...(!isBlank(state.refNameAliasesLocation)
      ? {
          refNameAliases: {
            adapter: {
              type: 'RefNameAliasAdapter',
              location: state.refNameAliasesLocation,
            },
          },
        }
      : {}),
    ...(!isBlank(state.cytobandsLocation)
      ? {
          cytobands: {
            adapter: {
              type: 'CytobandAdapter',
              cytobandLocation: state.cytobandsLocation,
            },
          },
        }
      : {}),
  }
}

export type AssemblyAdapter =
  | {
      type: 'IndexedFastaAdapter'
      fastaLocation: FileLocation
      faiLocation: FileLocation
    }
  | {
      type: 'BgzipFastaAdapter'
      fastaLocation: FileLocation
      faiLocation: FileLocation
      gziLocation: FileLocation
    }
  | {
      type: 'TwoBitAdapter'
      twoBitLocation: FileLocation
      chromSizesLocation: FileLocation
    }

export type AssemblyConf = ReturnType<typeof getBaseAssemblyConfig> & {
  sequence: {
    type: 'ReferenceSequenceTrack'
    trackId: string
    adapter: AssemblyAdapter
  }
}

export function isBlank(location: FileLocation) {
  return 'uri' in location && location.uri === ''
}

// The form can be opened only once its primary sequence file is chosen: the
// 2bit for TwoBitAdapter, otherwise the FASTA. Secondary files (.fai/.gzi) are
// validated later in getAdapterConfig.
export function formHasSequence(form: FormState) {
  return form.adapterSelection === 'TwoBitAdapter'
    ? !isBlank(form.twoBitLocation)
    : !isBlank(form.fastaLocation)
}

export function getFilename(location: FileLocation) {
  if ('uri' in location) {
    return location.uri.split('/').pop() ?? ''
  }
  if ('localPath' in location) {
    return location.localPath.split('/').pop() ?? ''
  }
  return ''
}

export function getAssemblyNameFromFilename(filename: string) {
  return filename
    .replace(/\.(fa|fasta|fna)\.gz$/, '')
    .replace(/\.(fa|fasta|fna)$/, '')
    .replace(/\.2bit$/, '')
}

export function detectAdapterType(filename: string): AdapterType | undefined {
  if (/\.(fa|fasta|fna)\.gz$/.test(filename)) {
    return 'BgzipFastaAdapter'
  }
  if (filename.endsWith('.2bit')) {
    return 'TwoBitAdapter'
  }
  return undefined
}

export type FileRole =
  | 'fasta'
  | 'fastaGz'
  | 'fai'
  | 'gzi'
  | 'twoBit'
  | 'chromSizes'
  | 'cytobands'
  | 'refNameAliases'

// Classify a single filename into the assembly slot it belongs to, by
// extension. Returns undefined for files we can't place. Order matters: index
// sidecars (.fai/.gzi) are checked before the fasta patterns they share a stem
// with, and the fasta patterns before the looser cytoband/alias name matches.
export function classifyFilename(filename: string): FileRole | undefined {
  return filename.endsWith('.fai')
    ? 'fai'
    : filename.endsWith('.gzi')
      ? 'gzi'
      : filename.endsWith('.2bit')
        ? 'twoBit'
        : /\.(fa|fasta|fna)\.gz$/.test(filename)
          ? 'fastaGz'
          : /\.(fa|fasta|fna)$/.test(filename)
            ? 'fasta'
            : filename.endsWith('.chrom.sizes')
              ? 'chromSizes'
              : /cytoband/i.test(filename)
                ? 'cytobands'
                : /alias/i.test(filename)
                  ? 'refNameAliases'
                  : undefined
}

// Sort a dropped/pasted set of files into the assembly form fields, picking the
// adapter and assembly name from whichever file is the primary sequence.
export function classifyAssemblyFiles(
  locations: FileLocation[],
): Partial<FormState> {
  const result: Partial<FormState> = {}
  let primaryFilename: string | undefined
  for (const location of locations) {
    const filename = getFilename(location)
    const role = classifyFilename(filename)
    if (role === 'fai') {
      result.faiLocation = location
    } else if (role === 'gzi') {
      result.gziLocation = location
    } else if (role === 'twoBit') {
      result.twoBitLocation = location
      result.adapterSelection = 'TwoBitAdapter'
      primaryFilename = filename
    } else if (role === 'fastaGz') {
      result.fastaLocation = location
      result.adapterSelection = 'BgzipFastaAdapter'
      primaryFilename = filename
    } else if (role === 'fasta') {
      result.fastaLocation = location
      if (result.adapterSelection === undefined) {
        result.adapterSelection = 'IndexedFastaAdapter'
      }
      primaryFilename = filename
    } else if (role === 'chromSizes') {
      result.chromSizesLocation = location
    } else if (role === 'cytobands') {
      result.cytobandsLocation = location
    } else if (role === 'refNameAliases') {
      result.refNameAliasesLocation = location
    }
  }
  if (primaryFilename) {
    result.assemblyName = getAssemblyNameFromFilename(primaryFilename)
  }
  // a plain FASTA with no .fai in the set indexes itself on submit
  if (
    result.adapterSelection === 'IndexedFastaAdapter' &&
    result.faiLocation === undefined
  ) {
    result.adapterSelection = 'FastaAdapter'
  }
  return result
}

// Rebuild the file-location fields (plus adapter/name) of `state` from a freshly
// classified set of dropped/pasted files. File fields are authoritative: any not
// present in `locations` reset to blank, so removing an input clears its field.
// assemblyName comes from the primary file unless `keepName` is set (the user
// edited the name themselves).
export function applyClassifiedFiles(
  state: FormState,
  locations: FileLocation[],
  keepName: boolean,
): FormState {
  const classified = classifyAssemblyFiles(locations)
  return {
    ...state,
    fastaLocation: classified.fastaLocation ?? blank,
    faiLocation: classified.faiLocation ?? blank,
    gziLocation: classified.gziLocation ?? blank,
    twoBitLocation: classified.twoBitLocation ?? blank,
    chromSizesLocation: classified.chromSizesLocation ?? blank,
    refNameAliasesLocation: classified.refNameAliasesLocation ?? blank,
    cytobandsLocation: classified.cytobandsLocation ?? blank,
    adapterSelection: classified.adapterSelection ?? state.adapterSelection,
    assemblyName: keepName
      ? state.assemblyName
      : (classified.assemblyName ?? ''),
  }
}

// Build a full assembly config from the form. A plain FASTA has no index, so
// the caller supplies an indexFasta callback (it runs an out-of-process samtools
// faidx in the desktop main process) used only for the needsFastaIndex case.
export async function buildAssemblyConf(
  form: FormState,
  indexFasta: (fastaLocation: FileLocation) => Promise<AssemblyAdapter>,
): Promise<AssemblyConf> {
  const result = getAdapterConfig(form)
  const adapter =
    result.kind === 'needsFastaIndex'
      ? await indexFasta(result.fastaLocation)
      : result.adapter
  return {
    ...getBaseAssemblyConfig(form),
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${form.assemblyName}-${Date.now()}`,
      adapter,
    },
  }
}

export function urlTextToLocations(text: string): FileLocation[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(uri => ({ uri, locationType: 'UriLocation' as const }))
}

// Either a ready-to-use sequence adapter, or a signal that the chosen plain
// FASTA must have a .fai generated before it can become an IndexedFastaAdapter.
// Kept as a discriminated union rather than a sentinel property so the caller
// can't accidentally write an un-indexed FASTA into a saved config.
export type AdapterConfigResult =
  | { kind: 'ready'; adapter: AssemblyAdapter }
  | { kind: 'needsFastaIndex'; fastaLocation: FileLocation }

export function getAdapterConfig({
  adapterSelection,
  fastaLocation,
  faiLocation,
  gziLocation,
  twoBitLocation,
  chromSizesLocation,
}: {
  adapterSelection: AdapterType
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
}): AdapterConfigResult {
  if (adapterSelection === 'FastaAdapter') {
    if (isBlank(fastaLocation)) {
      throw new Error('FASTA location is required')
    }
    return { kind: 'needsFastaIndex', fastaLocation }
  }
  if (adapterSelection === 'IndexedFastaAdapter') {
    if (isBlank(fastaLocation) || isBlank(faiLocation)) {
      throw new Error('Both FASTA and FAI locations are required')
    }
    return {
      kind: 'ready',
      adapter: { type: 'IndexedFastaAdapter', fastaLocation, faiLocation },
    }
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
    if (
      isBlank(fastaLocation) ||
      isBlank(faiLocation) ||
      isBlank(gziLocation)
    ) {
      throw new Error('FASTA, FAI, and GZI locations are all required')
    }
    return {
      kind: 'ready',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation,
        faiLocation,
        gziLocation,
      },
    }
  }
  if (isBlank(twoBitLocation)) {
    throw new Error('2bit location is required')
  }
  return {
    kind: 'ready',
    adapter: { type: 'TwoBitAdapter', twoBitLocation, chromSizesLocation },
  }
}
