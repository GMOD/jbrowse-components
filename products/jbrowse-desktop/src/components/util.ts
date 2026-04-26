import type { FileLocation } from '@jbrowse/core/util/types'

export type AdapterType =
  | 'IndexedFastaAdapter'
  | 'BgzipFastaAdapter'
  | 'FastaAdapter'
  | 'TwoBitAdapter'

export const adapterTypes: AdapterType[] = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'FastaAdapter',
  'TwoBitAdapter',
]

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
    adapterSelection: adapterTypes[0]!,
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

export function applyPrimaryFile(state: FormState, location: FileLocation): FormState {
  const filename = getFilename(location)
  const detected = filename ? detectAdapterType(filename) : undefined
  const assemblyName =
    filename && !state.assemblyName
      ? getAssemblyNameFromFilename(filename)
      : state.assemblyName
  if (detected === 'TwoBitAdapter') {
    return { ...state, twoBitLocation: location, adapterSelection: 'TwoBitAdapter', assemblyName }
  }
  return {
    ...state,
    fastaLocation: location,
    ...(detected ? { adapterSelection: detected } : {}),
    assemblyName,
  }
}

export function applyTwoBitFile(state: FormState, location: FileLocation): FormState {
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
    ...(state.assemblyDisplayName ? { displayName: state.assemblyDisplayName } : {}),
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
              cytobandsLocation: state.cytobandsLocation,
            },
          },
        }
      : {}),
  }
}

export type AssemblyConf = ReturnType<typeof getBaseAssemblyConfig> & {
  sequence: { type: 'ReferenceSequenceTrack'; trackId: string; adapter: object }
}

export function isBlank(location: FileLocation) {
  return 'uri' in location && location.uri === ''
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
}) {
  if (adapterSelection === 'FastaAdapter') {
    if (isBlank(fastaLocation)) {
      throw new Error('FASTA location is required')
    }
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation,
      needsIndexing: true,
    }
  }
  if (adapterSelection === 'IndexedFastaAdapter') {
    if (isBlank(fastaLocation) || isBlank(faiLocation)) {
      throw new Error('Both FASTA and FAI locations are required')
    }
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation,
      faiLocation,
    }
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
    if (isBlank(fastaLocation) || isBlank(faiLocation) || isBlank(gziLocation)) {
      throw new Error('FASTA, FAI, and GZI locations are all required')
    }
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation,
      faiLocation,
      gziLocation,
    }
  }
  if (isBlank(twoBitLocation)) {
    throw new Error('2bit location is required')
  }
  return {
    type: 'TwoBitAdapter',
    twoBitLocation,
    chromSizesLocation,
  }
}
