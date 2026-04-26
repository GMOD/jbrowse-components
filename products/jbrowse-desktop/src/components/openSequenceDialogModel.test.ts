import {
  applyPrimaryFile,
  applyTwoBitFile,
  clearFormFields,
  getAdapterConfig,
  getBaseAssemblyConfig,
  initialFormState,
} from './util.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

const blank = { uri: '' } as FileLocation
const fasta = { uri: 'https://example.com/hg38.fa' } as FileLocation
const fastaGz = { uri: 'https://example.com/hg38.fa.gz' } as FileLocation
const fai = { uri: 'https://example.com/hg38.fa.fai' } as FileLocation
const gzi = { uri: 'https://example.com/hg38.fa.gz.gzi' } as FileLocation
const twobit = { uri: 'https://example.com/hg38.2bit' } as FileLocation
const aliases = { uri: 'https://example.com/aliases.txt' } as FileLocation
const cytobands = { uri: 'https://example.com/cytobands.txt' } as FileLocation

describe('applyPrimaryFile', () => {
  test('sets fastaLocation for plain fasta', () => {
    const s = applyPrimaryFile(initialFormState(), fasta)
    expect(s.fastaLocation).toBe(fasta)
  })

  test('detects BgzipFastaAdapter for .fa.gz', () => {
    const s = applyPrimaryFile(initialFormState(), fastaGz)
    expect(s.fastaLocation).toBe(fastaGz)
    expect(s.adapterSelection).toBe('BgzipFastaAdapter')
  })

  test('routes .2bit to twoBitLocation and selects TwoBitAdapter', () => {
    const s = applyPrimaryFile(initialFormState(), twobit)
    expect(s.twoBitLocation).toBe(twobit)
    expect(s.adapterSelection).toBe('TwoBitAdapter')
  })

  test('auto-fills assemblyName from filename', () => {
    const s = applyPrimaryFile(initialFormState(), fasta)
    expect(s.assemblyName).toBe('hg38')
  })

  test('does not overwrite assemblyName when already set', () => {
    const s = applyPrimaryFile({ ...initialFormState(), assemblyName: 'custom' }, fasta)
    expect(s.assemblyName).toBe('custom')
  })
})

describe('applyTwoBitFile', () => {
  test('sets twoBitLocation', () => {
    const s = applyTwoBitFile(initialFormState(), twobit)
    expect(s.twoBitLocation).toBe(twobit)
  })

  test('auto-fills assemblyName from filename', () => {
    const s = applyTwoBitFile(initialFormState(), twobit)
    expect(s.assemblyName).toBe('hg38')
  })

  test('does not overwrite assemblyName when already set', () => {
    const s = applyTwoBitFile({ ...initialFormState(), assemblyName: 'custom' }, twobit)
    expect(s.assemblyName).toBe('custom')
  })
})

describe('clearFormFields', () => {
  test('resets file locations and name fields', () => {
    const s = clearFormFields({
      ...initialFormState(),
      fastaLocation: fasta,
      faiLocation: fai,
      assemblyName: 'hg38',
      assemblyDisplayName: 'Homo sapiens',
    })
    expect(s.fastaLocation).toEqual(blank)
    expect(s.faiLocation).toEqual(blank)
    expect(s.assemblyName).toBe('')
    expect(s.assemblyDisplayName).toBe('')
  })

  test('preserves adapterSelection', () => {
    const s = clearFormFields({ ...initialFormState(), adapterSelection: 'BgzipFastaAdapter' })
    expect(s.adapterSelection).toBe('BgzipFastaAdapter')
  })
})

describe('getAdapterConfig', () => {
  test('throws when required locations are blank', () => {
    expect(() => getAdapterConfig(initialFormState())).toThrow()
  })

  test('returns IndexedFastaAdapter config when locations are set', () => {
    expect(
      getAdapterConfig({ ...initialFormState(), fastaLocation: fasta, faiLocation: fai }),
    ).toMatchObject({ type: 'IndexedFastaAdapter', fastaLocation: fasta, faiLocation: fai })
  })

  test('returns needsIndexing for FastaAdapter', () => {
    expect(
      getAdapterConfig({ ...initialFormState(), adapterSelection: 'FastaAdapter', fastaLocation: fasta }),
    ).toMatchObject({ needsIndexing: true })
  })

  test('returns BgzipFastaAdapter config', () => {
    expect(
      getAdapterConfig({
        ...initialFormState(),
        adapterSelection: 'BgzipFastaAdapter',
        fastaLocation: fastaGz,
        faiLocation: fai,
        gziLocation: gzi,
      }),
    ).toMatchObject({ type: 'BgzipFastaAdapter', fastaLocation: fastaGz, faiLocation: fai, gziLocation: gzi })
  })
})

describe('getBaseAssemblyConfig', () => {
  test('includes name', () => {
    expect(getBaseAssemblyConfig({ ...initialFormState(), assemblyName: 'hg38' })).toMatchObject({ name: 'hg38' })
  })

  test('includes displayName when set', () => {
    expect(
      getBaseAssemblyConfig({ ...initialFormState(), assemblyDisplayName: 'Homo sapiens' }),
    ).toMatchObject({ displayName: 'Homo sapiens' })
  })

  test('omits displayName when empty', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty('displayName')
  })

  test('includes refNameAliases when location is set', () => {
    expect(
      getBaseAssemblyConfig({ ...initialFormState(), refNameAliasesLocation: aliases }),
    ).toMatchObject({ refNameAliases: { adapter: { type: 'RefNameAliasAdapter', location: aliases } } })
  })

  test('omits refNameAliases when blank', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty('refNameAliases')
  })

  test('includes cytobands when location is set', () => {
    expect(
      getBaseAssemblyConfig({ ...initialFormState(), cytobandsLocation: cytobands }),
    ).toMatchObject({ cytobands: { adapter: { type: 'CytobandAdapter', cytobandsLocation: cytobands } } })
  })

  test('omits cytobands when blank', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty('cytobands')
  })
})
