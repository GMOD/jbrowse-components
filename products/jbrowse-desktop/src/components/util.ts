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
    if (
      isBlank(fastaLocation) ||
      isBlank(faiLocation) ||
      isBlank(gziLocation)
    ) {
      throw new Error('FASTA, FAI, and GZI locations are all required')
    }
    return {
      type: 'BgzipFastaAdapter',
      fastaLocation,
      faiLocation,
      gziLocation,
    }
  }
  // adapterSelection === 'TwoBitAdapter' at this point
  if (isBlank(twoBitLocation)) {
    throw new Error('2bit location is required')
  }
  return {
    type: 'TwoBitAdapter',
    twoBitLocation,
    chromSizesLocation,
  }
}
