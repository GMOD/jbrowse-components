import {
  applyClassifiedFiles,
  applyPrimaryFile,
  applyTwoBitFile,
  classifyAssemblyFiles,
  classifyFilename,
  clearFormFields,
  detectAdapterType,
  formHasSequence,
  getAdapterConfig,
  getAssemblyNameFromFilename,
  getBaseAssemblyConfig,
  getFilename,
  initialFormState,
  isBlank,
  urlTextToLocations,
} from './assemblyConfigUtils.ts'

import type { FileLocation } from './types/index.ts'

const blank = { uri: '' } as FileLocation
const fasta = { uri: 'https://example.com/hg38.fa' } as FileLocation
const fastaGz = { uri: 'https://example.com/hg38.fa.gz' } as FileLocation
const fai = { uri: 'https://example.com/hg38.fa.fai' } as FileLocation
const gzi = { uri: 'https://example.com/hg38.fa.gz.gzi' } as FileLocation
const twobit = { uri: 'https://example.com/hg38.2bit' } as FileLocation
const aliases = { uri: 'https://example.com/aliases.txt' } as FileLocation
const cytobands = { uri: 'https://example.com/cytobands.txt' } as FileLocation
const local = {
  localPath: '/data/hg38.fa',
  locationType: 'LocalPathLocation',
} as FileLocation

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

describe('formHasSequence', () => {
  test('false for a freshly initialized form', () => {
    expect(formHasSequence(initialFormState())).toBe(false)
  })

  test('true once a FASTA is set for a fasta adapter', () => {
    expect(
      formHasSequence({ ...initialFormState(), fastaLocation: fasta }),
    ).toBe(true)
  })

  test('true once a 2bit is set for TwoBitAdapter', () => {
    expect(
      formHasSequence({
        ...initialFormState(),
        adapterSelection: 'TwoBitAdapter',
        twoBitLocation: twobit,
      }),
    ).toBe(true)
  })

  test('false when only a 2bit is set but a fasta adapter is selected', () => {
    expect(
      formHasSequence({ ...initialFormState(), twoBitLocation: twobit }),
    ).toBe(false)
  })

  test('false when only a fasta is set but TwoBitAdapter is selected', () => {
    expect(
      formHasSequence({
        ...initialFormState(),
        adapterSelection: 'TwoBitAdapter',
        fastaLocation: fasta,
      }),
    ).toBe(false)
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
    const blob = {
      blobId: 'abc',
      name: 'hg38.fa',
      locationType: 'BlobLocation',
    } as FileLocation
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

  test('FastaAdapter signals the FASTA needs indexing', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'FastaAdapter',
      fastaLocation: fasta,
    })
    expect(result).toEqual({
      kind: 'needsFastaIndex',
      fastaLocation: fasta,
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
      kind: 'ready',
      adapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: fasta,
        faiLocation: fai,
      },
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
      kind: 'ready',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: fasta,
        faiLocation: fai,
        gziLocation: gzi,
      },
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
      kind: 'ready',
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: twobit,
      },
    })
  })
})

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
    const s = applyPrimaryFile(
      { ...initialFormState(), assemblyName: 'custom' },
      fasta,
    )
    expect(s.assemblyName).toBe('custom')
  })

  test('prefills .fai sidecar for indexed fasta URI', () => {
    const s = applyPrimaryFile(initialFormState(), fasta)
    expect(s.faiLocation).toEqual({ uri: 'https://example.com/hg38.fa.fai' })
  })

  test('prefills .fai and .gzi sidecars for bgzip fasta URI', () => {
    const s = applyPrimaryFile(initialFormState(), fastaGz)
    expect(s.faiLocation).toEqual({ uri: 'https://example.com/hg38.fa.gz.fai' })
    expect(s.gziLocation).toEqual({ uri: 'https://example.com/hg38.fa.gz.gzi' })
  })

  test('does not overwrite a sidecar the user already set', () => {
    const s = applyPrimaryFile(
      { ...initialFormState(), faiLocation: fai },
      fasta,
    )
    expect(s.faiLocation).toBe(fai)
  })

  test('prefills .fai sidecar for local path fasta', () => {
    const s = applyPrimaryFile(initialFormState(), local)
    expect(s.faiLocation).toEqual({
      localPath: '/data/hg38.fa.fai',
      locationType: 'LocalPathLocation',
    })
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
    const s = applyTwoBitFile(
      { ...initialFormState(), assemblyName: 'custom' },
      twobit,
    )
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
    const s = clearFormFields({
      ...initialFormState(),
      adapterSelection: 'BgzipFastaAdapter',
    })
    expect(s.adapterSelection).toBe('BgzipFastaAdapter')
  })
})

describe('classifyFilename', () => {
  test.each([
    ['hg38.fa', 'fasta'],
    ['hg38.fasta', 'fasta'],
    ['hg38.fna', 'fasta'],
    ['hg38.fa.gz', 'fastaGz'],
    ['hg38.fasta.gz', 'fastaGz'],
    ['hg38.fa.fai', 'fai'],
    ['hg38.fa.gz.fai', 'fai'],
    ['hg38.fa.gz.gzi', 'gzi'],
    ['hg38.2bit', 'twoBit'],
    ['hg38.chrom.sizes', 'chromSizes'],
    ['cytoBandIdeo.txt', 'cytobands'],
    ['hg38.chromAlias.txt', 'refNameAliases'],
  ])('classifies %s as %s', (filename, role) => {
    expect(classifyFilename(filename)).toBe(role)
  })

  test('returns undefined for unrecognized files', () => {
    expect(classifyFilename('hg38.bam')).toBeUndefined()
  })

  test('a fasta named like an alias is still a fasta', () => {
    expect(classifyFilename('myalias.fa')).toBe('fasta')
  })
})

describe('classifyAssemblyFiles', () => {
  test('sorts a bgzip trio into fields and picks adapter + name', () => {
    expect(
      classifyAssemblyFiles([
        { uri: 'https://example.com/hg38.fa.gz' },
        { uri: 'https://example.com/hg38.fa.gz.fai' },
        { uri: 'https://example.com/hg38.fa.gz.gzi' },
      ] as FileLocation[]),
    ).toEqual({
      fastaLocation: { uri: 'https://example.com/hg38.fa.gz' },
      faiLocation: { uri: 'https://example.com/hg38.fa.gz.fai' },
      gziLocation: { uri: 'https://example.com/hg38.fa.gz.gzi' },
      adapterSelection: 'BgzipFastaAdapter',
      assemblyName: 'hg38',
    })
  })

  test('sorts an indexed fasta pair', () => {
    expect(classifyAssemblyFiles([fasta, fai])).toMatchObject({
      fastaLocation: fasta,
      faiLocation: fai,
      adapterSelection: 'IndexedFastaAdapter',
      assemblyName: 'hg38',
    })
  })

  test('a lone fasta with no index falls back to FastaAdapter', () => {
    expect(classifyAssemblyFiles([fasta])).toMatchObject({
      fastaLocation: fasta,
      adapterSelection: 'FastaAdapter',
      assemblyName: 'hg38',
    })
  })

  test('routes a 2bit to TwoBitAdapter', () => {
    expect(classifyAssemblyFiles([twobit])).toMatchObject({
      twoBitLocation: twobit,
      adapterSelection: 'TwoBitAdapter',
      assemblyName: 'hg38',
    })
  })

  test('places aliases and cytobands', () => {
    const s = classifyAssemblyFiles([
      { uri: 'https://example.com/hg38.chromAlias.txt' },
      { uri: 'https://example.com/cytoBandIdeo.txt.gz' },
    ] as FileLocation[])
    expect(s.refNameAliasesLocation).toEqual({
      uri: 'https://example.com/hg38.chromAlias.txt',
    })
    expect(s.cytobandsLocation).toEqual({
      uri: 'https://example.com/cytoBandIdeo.txt.gz',
    })
  })

  test('ignores unrecognized files', () => {
    expect(classifyAssemblyFiles([{ uri: 'x.bam' } as FileLocation])).toEqual(
      {},
    )
  })
})

describe('applyClassifiedFiles', () => {
  test('fills fields, adapter, and name from the file set', () => {
    const s = applyClassifiedFiles(initialFormState(), [fasta, fai], false)
    expect(s.fastaLocation).toBe(fasta)
    expect(s.faiLocation).toBe(fai)
    expect(s.adapterSelection).toBe('IndexedFastaAdapter')
    expect(s.assemblyName).toBe('hg38')
  })

  test('resets fields no longer present in the set (authoritative)', () => {
    const withBoth = applyClassifiedFiles(
      initialFormState(),
      [fasta, fai],
      false,
    )
    const withoutFai = applyClassifiedFiles(withBoth, [fasta], false)
    expect(withoutFai.faiLocation).toEqual(blank)
    expect(withoutFai.fastaLocation).toBe(fasta)
  })

  test('keeps a user-edited assembly name when keepName is set', () => {
    const s = applyClassifiedFiles(
      { ...initialFormState(), assemblyName: 'custom' },
      [fasta],
      true,
    )
    expect(s.assemblyName).toBe('custom')
  })

  test('clears to blank for an empty set', () => {
    const filled = applyClassifiedFiles(initialFormState(), [fasta, fai], false)
    const cleared = applyClassifiedFiles(filled, [], false)
    expect(cleared.fastaLocation).toEqual(blank)
    expect(cleared.faiLocation).toEqual(blank)
    expect(cleared.assemblyName).toBe('')
  })
})

describe('urlTextToLocations', () => {
  test('parses non-empty trimmed lines into UriLocations', () => {
    expect(
      urlTextToLocations(
        '  https://example.com/a.fa \n\nhttps://example.com/a.fa.fai\n',
      ),
    ).toEqual([
      { uri: 'https://example.com/a.fa', locationType: 'UriLocation' },
      { uri: 'https://example.com/a.fa.fai', locationType: 'UriLocation' },
    ])
  })
})

describe('getBaseAssemblyConfig', () => {
  test('includes name', () => {
    expect(
      getBaseAssemblyConfig({ ...initialFormState(), assemblyName: 'hg38' }),
    ).toMatchObject({ name: 'hg38' })
  })

  test('includes displayName when set', () => {
    expect(
      getBaseAssemblyConfig({
        ...initialFormState(),
        assemblyDisplayName: 'Homo sapiens',
      }),
    ).toMatchObject({ displayName: 'Homo sapiens' })
  })

  test('omits displayName when empty', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty(
      'displayName',
    )
  })

  test('includes refNameAliases when location is set', () => {
    expect(
      getBaseAssemblyConfig({
        ...initialFormState(),
        refNameAliasesLocation: aliases,
      }),
    ).toMatchObject({
      refNameAliases: {
        adapter: { type: 'RefNameAliasAdapter', location: aliases },
      },
    })
  })

  test('omits refNameAliases when blank', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty(
      'refNameAliases',
    )
  })

  test('includes cytobands when location is set', () => {
    expect(
      getBaseAssemblyConfig({
        ...initialFormState(),
        cytobandsLocation: cytobands,
      }),
    ).toMatchObject({
      cytobands: {
        adapter: { type: 'CytobandAdapter', cytobandLocation: cytobands },
      },
    })
  })

  test('omits cytobands when blank', () => {
    expect(getBaseAssemblyConfig(initialFormState())).not.toHaveProperty(
      'cytobands',
    )
  })
})
