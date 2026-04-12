import {
  detectAdapterType,
  getAdapterConfig,
  getAssemblyNameFromFilename,
  getFilename,
  isBlank,
} from './util'

import type { FileLocation } from '@jbrowse/core/util/types'

const blank = { uri: '' } as FileLocation
const fasta = { uri: 'https://example.com/hg38.fa' } as FileLocation
const fai = { uri: 'https://example.com/hg38.fa.fai' } as FileLocation
const gzi = { uri: 'https://example.com/hg38.fa.gz.gzi' } as FileLocation
const twobit = { uri: 'https://example.com/hg38.2bit' } as FileLocation
const local = { localPath: '/data/hg38.fa', locationType: 'LocalPathLocation' } as FileLocation

describe('isBlank', () => {
  test('returns true for empty uri', () => {
    expect(isBlank(blank)).toBe(true)
  })

  test('returns false for non-empty uri', () => {
    expect(isBlank(fasta)).toBe(false)
  })

  test('returns false for localPath location', () => {
    expect(isBlank(local)).toBe(false)
  })
})

describe('getFilename', () => {
  test('extracts filename from URI', () => {
    expect(getFilename(fasta)).toBe('hg38.fa')
  })

  test('extracts filename from local path', () => {
    expect(getFilename(local)).toBe('hg38.fa')
  })

  test('returns empty string for blob location', () => {
    const blob = { blobId: 'abc', name: 'hg38.fa', locationType: 'BlobLocation' } as FileLocation
    expect(getFilename(blob)).toBe('')
  })

  test('returns empty string for blank location', () => {
    expect(getFilename(blank)).toBe('')
  })
})

describe('getAssemblyNameFromFilename', () => {
  test('strips .fa extension', () => {
    expect(getAssemblyNameFromFilename('hg38.fa')).toBe('hg38')
  })

  test('strips .fasta extension', () => {
    expect(getAssemblyNameFromFilename('hg38.fasta')).toBe('hg38')
  })

  test('strips .fna extension', () => {
    expect(getAssemblyNameFromFilename('hg38.fna')).toBe('hg38')
  })

  test('strips .fa.gz extension', () => {
    expect(getAssemblyNameFromFilename('hg38.fa.gz')).toBe('hg38')
  })

  test('strips .2bit extension', () => {
    expect(getAssemblyNameFromFilename('hg38.2bit')).toBe('hg38')
  })

  test('leaves unrecognized extensions alone', () => {
    expect(getAssemblyNameFromFilename('hg38.bam')).toBe('hg38.bam')
  })
})

describe('detectAdapterType', () => {
  test('detects .fa.gz as BgzipFastaAdapter', () => {
    expect(detectAdapterType('hg38.fa.gz')).toBe('BgzipFastaAdapter')
  })

  test('detects .fasta.gz as BgzipFastaAdapter', () => {
    expect(detectAdapterType('hg38.fasta.gz')).toBe('BgzipFastaAdapter')
  })

  test('detects .2bit as TwoBitAdapter', () => {
    expect(detectAdapterType('hg38.2bit')).toBe('TwoBitAdapter')
  })

  test('returns undefined for plain .fa (ambiguous)', () => {
    expect(detectAdapterType('hg38.fa')).toBeUndefined()
  })

  test('returns undefined for .fai (secondary file)', () => {
    expect(detectAdapterType('hg38.fa.fai')).toBeUndefined()
  })

  test('returns undefined for unknown extension', () => {
    expect(detectAdapterType('hg38.bam')).toBeUndefined()
  })
})

describe('getAdapterConfig', () => {
  const base = {
    fastaLocation: blank,
    faiLocation: blank,
    gziLocation: blank,
    twoBitLocation: blank,
    chromSizesLocation: blank,
  }

  test('FastaAdapter throws when fasta is blank', () => {
    expect(() =>
      getAdapterConfig({ ...base, adapterSelection: 'FastaAdapter' }),
    ).toThrow('FASTA location is required')
  })

  test('FastaAdapter returns IndexedFastaAdapter config with needsIndexing', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'FastaAdapter',
      fastaLocation: fasta,
    })
    expect(result).toMatchObject({
      type: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      needsIndexing: true,
    })
  })

  test('IndexedFastaAdapter throws when fai is blank', () => {
    expect(() =>
      getAdapterConfig({
        ...base,
        adapterSelection: 'IndexedFastaAdapter',
        fastaLocation: fasta,
      }),
    ).toThrow('Both FASTA and FAI locations are required')
  })

  test('IndexedFastaAdapter returns correct config', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
    })
    expect(result).toMatchObject({
      type: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
    })
  })

  test('BgzipFastaAdapter throws when gzi is blank', () => {
    expect(() =>
      getAdapterConfig({
        ...base,
        adapterSelection: 'BgzipFastaAdapter',
        fastaLocation: fasta,
        faiLocation: fai,
      }),
    ).toThrow('FASTA, FAI, and GZI locations are all required')
  })

  test('BgzipFastaAdapter returns correct config', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'BgzipFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
      gziLocation: gzi,
    })
    expect(result).toMatchObject({
      type: 'BgzipFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
      gziLocation: gzi,
    })
  })

  test('TwoBitAdapter throws when 2bit is blank', () => {
    expect(() =>
      getAdapterConfig({ ...base, adapterSelection: 'TwoBitAdapter' }),
    ).toThrow('2bit location is required')
  })

  test('TwoBitAdapter returns correct config', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'TwoBitAdapter',
      twoBitLocation: twobit,
    })
    expect(result).toMatchObject({
      type: 'TwoBitAdapter',
      twoBitLocation: twobit,
    })
  })
})
