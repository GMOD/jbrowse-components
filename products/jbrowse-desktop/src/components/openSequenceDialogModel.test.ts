import { createOpenSequenceDialogModel } from './openSequenceDialogModel.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

const blank = { uri: '' } as FileLocation
const fasta = { uri: 'https://example.com/hg38.fa' } as FileLocation
const fastaGz = { uri: 'https://example.com/hg38.fa.gz' } as FileLocation
const fai = { uri: 'https://example.com/hg38.fa.fai' } as FileLocation
const gzi = { uri: 'https://example.com/hg38.fa.gz.gzi' } as FileLocation
const twobit = { uri: 'https://example.com/hg38.2bit' } as FileLocation
const aliases = { uri: 'https://example.com/aliases.txt' } as FileLocation
const cytobands = { uri: 'https://example.com/cytobands.txt' } as FileLocation

describe('setPrimaryFile', () => {
  test('sets fastaLocation for plain fasta', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fasta)
    expect(m.fastaLocation).toBe(fasta)
  })

  test('detects BgzipFastaAdapter for .fa.gz', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fastaGz)
    expect(m.fastaLocation).toBe(fastaGz)
    expect(m.adapterSelection).toBe('BgzipFastaAdapter')
  })

  test('routes .2bit to twoBitLocation and selects TwoBitAdapter', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(twobit)
    expect(m.twoBitLocation).toBe(twobit)
    expect(m.adapterSelection).toBe('TwoBitAdapter')
  })

  test('auto-fills assemblyName from filename', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fasta)
    expect(m.assemblyName).toBe('hg38')
  })

  test('does not overwrite assemblyName when already set', () => {
    const m = createOpenSequenceDialogModel()
    m.setAssemblyName('custom')
    m.setPrimaryFile(fasta)
    expect(m.assemblyName).toBe('custom')
  })
})

describe('setTwoBitFile', () => {
  test('sets twoBitLocation', () => {
    const m = createOpenSequenceDialogModel()
    m.setTwoBitFile(twobit)
    expect(m.twoBitLocation).toBe(twobit)
  })

  test('auto-fills assemblyName from filename', () => {
    const m = createOpenSequenceDialogModel()
    m.setTwoBitFile(twobit)
    expect(m.assemblyName).toBe('hg38')
  })

  test('does not overwrite assemblyName when already set', () => {
    const m = createOpenSequenceDialogModel()
    m.setAssemblyName('custom')
    m.setTwoBitFile(twobit)
    expect(m.assemblyName).toBe('custom')
  })
})

describe('clearFormState', () => {
  test('resets file locations and name fields', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fasta)
    m.setFaiLocation(fai)
    m.setAssemblyName('hg38')
    m.setAssemblyDisplayName('Homo sapiens')
    m.clearFormState()
    expect(m.fastaLocation).toEqual(blank)
    expect(m.faiLocation).toEqual(blank)
    expect(m.assemblyName).toBe('')
    expect(m.assemblyDisplayName).toBe('')
  })

  test('preserves adapterSelection', () => {
    const m = createOpenSequenceDialogModel()
    m.setAdapterSelection('BgzipFastaAdapter')
    m.clearFormState()
    expect(m.adapterSelection).toBe('BgzipFastaAdapter')
  })
})

describe('adapterConfig', () => {
  test('throws when required locations are blank', () => {
    const m = createOpenSequenceDialogModel()
    // default is IndexedFastaAdapter with blank locations
    expect(() => m.adapterConfig).toThrow()
  })

  test('returns IndexedFastaAdapter config when locations are set', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fasta)
    m.setFaiLocation(fai)
    expect(m.adapterConfig).toMatchObject({
      type: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
    })
  })

  test('returns needsIndexing for FastaAdapter', () => {
    const m = createOpenSequenceDialogModel()
    m.setAdapterSelection('FastaAdapter')
    m.setPrimaryFile(fasta)
    expect(m.adapterConfig).toMatchObject({ needsIndexing: true })
  })

  test('returns BgzipFastaAdapter config', () => {
    const m = createOpenSequenceDialogModel()
    m.setPrimaryFile(fastaGz)
    m.setFaiLocation(fai)
    m.setGziLocation(gzi)
    expect(m.adapterConfig).toMatchObject({
      type: 'BgzipFastaAdapter',
      fastaLocation: fastaGz,
      faiLocation: fai,
      gziLocation: gzi,
    })
  })
})

describe('baseAssemblyConfig', () => {
  test('includes name', () => {
    const m = createOpenSequenceDialogModel()
    m.setAssemblyName('hg38')
    expect(m.baseAssemblyConfig).toMatchObject({ name: 'hg38' })
  })

  test('includes displayName when set', () => {
    const m = createOpenSequenceDialogModel()
    m.setAssemblyDisplayName('Homo sapiens')
    expect(m.baseAssemblyConfig).toMatchObject({ displayName: 'Homo sapiens' })
  })

  test('omits displayName when empty', () => {
    const m = createOpenSequenceDialogModel()
    expect(m.baseAssemblyConfig).not.toHaveProperty('displayName')
  })

  test('includes refNameAliases when location is set', () => {
    const m = createOpenSequenceDialogModel()
    m.setRefNameAliasesLocation(aliases)
    expect(m.baseAssemblyConfig).toMatchObject({
      refNameAliases: {
        adapter: { type: 'RefNameAliasAdapter', location: aliases },
      },
    })
  })

  test('omits refNameAliases when blank', () => {
    const m = createOpenSequenceDialogModel()
    expect(m.baseAssemblyConfig).not.toHaveProperty('refNameAliases')
  })

  test('includes cytobands when location is set', () => {
    const m = createOpenSequenceDialogModel()
    m.setCytobandsLocation(cytobands)
    expect(m.baseAssemblyConfig).toMatchObject({
      cytobands: {
        adapter: { type: 'CytobandAdapter', cytobandsLocation: cytobands },
      },
    })
  })

  test('omits cytobands when blank', () => {
    const m = createOpenSequenceDialogModel()
    expect(m.baseAssemblyConfig).not.toHaveProperty('cytobands')
  })
})
