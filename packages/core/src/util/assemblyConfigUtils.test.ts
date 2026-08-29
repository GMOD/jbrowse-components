import {
  applyClassifiedFiles,
  applyPrimaryFile,
  applyTwoBitFile,
  buildAssemblyConf,
  classifyAssemblyFiles,
  classifyFilename,
  classifyLocations,
  clearFormFields,
  clearSequenceFiles,
  detectAdapterType,
  formHasSequence,
  getAdapterConfig,
  getAssemblyName,
  getAssemblyNameFromFilename,
  getBaseAssemblyConfig,
  getMissingSidecars,
  initialFormState,
  isBlank,
  isFormDirty,
  isFormReady,
  isSequenceRole,
  partitionExtraLocations,
  urlTextToLocations,
} from './assemblyConfigUtils.ts'

import type { FormState } from './assemblyConfigUtils.ts'
import type { FileLocation } from './types/data.ts'

const noEdits: ReadonlySet<keyof FormState> = new Set()

const blank = { uri: '', locationType: 'UriLocation' } as FileLocation
const fasta = {
  uri: 'https://example.com/hg38.fa',
  locationType: 'UriLocation',
} as FileLocation
const fastaGz = {
  uri: 'https://example.com/hg38.fa.gz',
  locationType: 'UriLocation',
} as FileLocation
const fai = {
  uri: 'https://example.com/hg38.fa.fai',
  locationType: 'UriLocation',
} as FileLocation
const gzi = {
  uri: 'https://example.com/hg38.fa.gz.gzi',
  locationType: 'UriLocation',
} as FileLocation
const twobit = {
  uri: 'https://example.com/hg38.2bit',
  locationType: 'UriLocation',
} as FileLocation
const chromSizes = {
  uri: 'https://example.com/hg38.chrom.sizes',
  locationType: 'UriLocation',
} as FileLocation
const aliases = {
  uri: 'https://example.com/aliases.txt',
  locationType: 'UriLocation',
} as FileLocation
const cytobands = {
  uri: 'https://example.com/cytobands.txt',
  locationType: 'UriLocation',
} as FileLocation
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

  // A blank location is a UriLocation with an empty uri, which is resolved like
  // any other relative one: on desktop it lands on the session file's directory
  // and the assembly fails to load with EISDIR. The slot is optional, so leave
  // it out.
  test('TwoBitAdapter omits chromSizes when none was given', () => {
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'TwoBitAdapter',
      twoBitLocation: twobit,
    })
    expect(result).toEqual({
      kind: 'ready',
      adapter: { type: 'TwoBitAdapter', twoBitLocation: twobit },
    })
  })

  test('TwoBitAdapter keeps a chromSizes that was given', () => {
    const chromSizes = {
      uri: 'hg38.chrom.sizes',
      locationType: 'UriLocation' as const,
    }
    const result = getAdapterConfig({
      ...base,
      adapterSelection: 'TwoBitAdapter',
      twoBitLocation: twobit,
      chromSizesLocation: chromSizes,
    })
    expect(result).toEqual({
      kind: 'ready',
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: twobit,
        chromSizesLocation: chromSizes,
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
    expect(s.faiLocation).toEqual({
      uri: 'https://example.com/hg38.fa.fai',
      locationType: 'UriLocation',
    })
  })

  test('prefills .fai and .gzi sidecars for bgzip fasta URI', () => {
    const s = applyPrimaryFile(initialFormState(), fastaGz)
    expect(s.faiLocation).toEqual({
      uri: 'https://example.com/hg38.fa.gz.fai',
      locationType: 'UriLocation',
    })
    expect(s.gziLocation).toEqual({
      uri: 'https://example.com/hg38.fa.gz.gzi',
      locationType: 'UriLocation',
    })
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

describe('clearSequenceFiles', () => {
  test('clears sequence files but keeps name and metadata', () => {
    const s = clearSequenceFiles({
      ...initialFormState(),
      fastaLocation: fastaGz,
      faiLocation: fai,
      gziLocation: gzi,
      assemblyName: 'hg38',
      assemblyDisplayName: 'Homo sapiens',
      refNameAliasesLocation: aliases,
      cytobandsLocation: cytobands,
    })
    expect(s.fastaLocation).toEqual(blank)
    expect(s.faiLocation).toEqual(blank)
    expect(s.gziLocation).toEqual(blank)
    expect(s.assemblyName).toBe('hg38')
    expect(s.assemblyDisplayName).toBe('Homo sapiens')
    expect(s.refNameAliasesLocation).toEqual(aliases)
    expect(s.cytobandsLocation).toEqual(cytobands)
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
    // the extensions the sequence plugin's guessers accept: this table used to
    // be (fa|fasta|fna).gz and case-sensitive, so these loaded fine as tracks
    // but could not be placed in the add-genome pane
    ['hg38.fas', 'fasta'],
    ['hg38.mfa', 'fasta'],
    ['hg38.FA', 'fasta'],
    ['hg38.fa.bgz', 'fastaGz'],
    ['hg38.FASTA.GZ', 'fastaGz'],
    ['hg38.2BIT', 'twoBit'],
    ['hg38.fa.FAI', 'fai'],
  ])('classifies %s as %s', (filename, role) => {
    expect(classifyFilename(filename)).toBe(role)
  })

  test('returns undefined for unrecognized files', () => {
    expect(classifyFilename('hg38.bam')).toBeUndefined()
  })

  test('a fasta named like an alias is still a fasta', () => {
    expect(classifyFilename('myalias.fa')).toBe('fasta')
  })

  // every pattern here anchors to the end of the name, which is what getFileName
  // dropping a URI's query buys — a presigned link is covered by its test
  test('matches at the end of the name', () => {
    expect(classifyFilename('hg38.fa.gz.fai')).toBe('fai')
    expect(classifyFilename('hg38.fa.fai.bak')).toBeUndefined()
  })
})

describe('classifyAssemblyFiles', () => {
  // getFilename here inspected only uri/localPath, so a dropped file on
  // jbrowse-web (a BlobLocation) had no name to classify and every one of them
  // landed in the "Couldn't place" list
  test('places a dropped Blob by its name', () => {
    const blob = {
      blobId: 'abc',
      name: 'hg38.2bit',
      locationType: 'BlobLocation',
    } as FileLocation
    expect(classifyAssemblyFiles([blob])).toMatchObject({
      twoBitLocation: blob,
      adapterSelection: 'TwoBitAdapter',
      assemblyName: 'hg38',
    })
  })

  test('sorts a bgzip trio into fields and picks adapter + name', () => {
    expect(
      classifyAssemblyFiles([
        { uri: 'https://example.com/hg38.fa.gz', locationType: 'UriLocation' },
        {
          uri: 'https://example.com/hg38.fa.gz.fai',
          locationType: 'UriLocation',
        },
        {
          uri: 'https://example.com/hg38.fa.gz.gzi',
          locationType: 'UriLocation',
        },
      ] as FileLocation[]),
    ).toEqual({
      fastaLocation: {
        uri: 'https://example.com/hg38.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'https://example.com/hg38.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'https://example.com/hg38.fa.gz.gzi',
        locationType: 'UriLocation',
      },
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
      {
        uri: 'https://example.com/hg38.chromAlias.txt',
        locationType: 'UriLocation',
      },
      {
        uri: 'https://example.com/cytoBandIdeo.txt.gz',
        locationType: 'UriLocation',
      },
    ] as FileLocation[])
    expect(s.refNameAliasesLocation).toEqual({
      uri: 'https://example.com/hg38.chromAlias.txt',
      locationType: 'UriLocation',
    })
    expect(s.cytobandsLocation).toEqual({
      uri: 'https://example.com/cytoBandIdeo.txt.gz',
      locationType: 'UriLocation',
    })
  })

  test('ignores unrecognized files', () => {
    expect(
      classifyAssemblyFiles([{ uri: 'x.bam', locationType: 'UriLocation' }]),
    ).toEqual({})
  })

  // The adapter and the name were picked by two separate last-wins rules, and
  // only the .2bit branch could overwrite the adapter. So this order took the
  // sequence from one genome and the name from the other, and the pane's "more
  // than one genome" notice named the file it was not reading.
  describe('two genomes at once', () => {
    const mm39TwoBit = {
      uri: 'https://example.com/mm39.2bit',
      locationType: 'UriLocation',
    } as FileLocation

    test('a 2bit ahead of a fasta: the fasta answers for adapter and name', () => {
      expect(classifyAssemblyFiles([mm39TwoBit, fasta])).toEqual({
        fastaLocation: fasta,
        adapterSelection: 'FastaAdapter',
        assemblyName: 'hg38',
      })
    })

    test('a fasta ahead of a 2bit: the 2bit does', () => {
      expect(classifyAssemblyFiles([fasta, mm39TwoBit])).toEqual({
        twoBitLocation: mm39TwoBit,
        adapterSelection: 'TwoBitAdapter',
        assemblyName: 'mm39',
      })
    })
  })
})

describe('applyClassifiedFiles', () => {
  test('fills fields, adapter, and name from the file set', () => {
    const s = applyClassifiedFiles(initialFormState(), [fasta, fai], noEdits)
    expect(s.fastaLocation).toBe(fasta)
    expect(s.faiLocation).toBe(fai)
    expect(s.adapterSelection).toBe('IndexedFastaAdapter')
    expect(s.assemblyName).toBe('hg38')
  })

  test('resets fields no longer present in the set (authoritative)', () => {
    const withBoth = applyClassifiedFiles(
      initialFormState(),
      [fasta, fai],
      noEdits,
    )
    const withoutFai = applyClassifiedFiles(withBoth, [fasta], noEdits)
    expect(withoutFai.faiLocation).toEqual(blank)
    expect(withoutFai.fastaLocation).toBe(fasta)
  })

  test('keeps a user-edited assembly name when keepName is set', () => {
    const s = applyClassifiedFiles(
      { ...initialFormState(), assemblyName: 'custom' },
      [fasta],
      new Set(['assemblyName' as const]),
    )
    expect(s.assemblyName).toBe('custom')
  })

  test('clears to blank for an empty set', () => {
    const filled = applyClassifiedFiles(
      initialFormState(),
      [fasta, fai],
      noEdits,
    )
    const cleared = applyClassifiedFiles(filled, [], noEdits)
    expect(cleared.fastaLocation).toEqual(blank)
    expect(cleared.faiLocation).toEqual(blank)
    expect(cleared.assemblyName).toBe('')
  })

  // "More options" sets these by hand, so a later file set that says nothing
  // about them must not answer for them — this is what the recognition card's
  // "change" link used to walk into, wiping aliases it had promised to keep
  test('a later file set leaves hand-entered aliases and cytobands alone', () => {
    const s = applyClassifiedFiles(
      {
        ...initialFormState(),
        refNameAliasesLocation: aliases,
        cytobandsLocation: cytobands,
      },
      [fasta, fai],
      noEdits,
    )
    expect(s.refNameAliasesLocation).toBe(aliases)
    expect(s.cytobandsLocation).toBe(cytobands)
  })

  // the pane's "this format needs its index" input writes faiLocation directly,
  // which the next paste into the URL box used to reset to blank — so the pane
  // re-asked for a file it already had
  test('a hand-entered sidecar survives a later file set', () => {
    const s = applyClassifiedFiles(
      { ...initialFormState(), faiLocation: fai },
      [fastaGz, gzi],
      new Set(['faiLocation' as const]),
    )
    expect(s.faiLocation).toBe(fai)
    expect(s.gziLocation).toBe(gzi)
  })

  test('but an unmarked one is still the file set to answer for', () => {
    const s = applyClassifiedFiles(
      { ...initialFormState(), faiLocation: fai },
      [fastaGz, gzi],
      noEdits,
    )
    expect(s.faiLocation).toEqual(blank)
  })

  test('but a file set that names one still wins', () => {
    const s = applyClassifiedFiles(
      { ...initialFormState(), refNameAliasesLocation: cytobands },
      [fasta, aliases],
      noEdits,
    )
    expect(s.refNameAliasesLocation).toBe(aliases)
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

describe('getAssemblyName', () => {
  test('trims surrounding whitespace', () => {
    expect(
      getAssemblyName({ ...initialFormState(), assemblyName: '  hg38  ' }),
    ).toBe('hg38')
  })

  test('empty for a whitespace-only name', () => {
    expect(
      getAssemblyName({ ...initialFormState(), assemblyName: '   ' }),
    ).toBe('')
  })
})

describe('getMissingSidecars', () => {
  test('nothing for a plain FASTA, which indexes itself', () => {
    expect(
      getMissingSidecars({
        ...initialFormState(),
        adapterSelection: 'FastaAdapter',
        fastaLocation: fasta,
      }),
    ).toEqual([])
  })

  test('the fai an indexed FASTA is missing', () => {
    expect(
      getMissingSidecars({
        ...initialFormState(),
        adapterSelection: 'IndexedFastaAdapter',
        fastaLocation: fasta,
      }).map(s => s.ext),
    ).toEqual(['.fai'])
  })

  test('both indexes a bgzipped FASTA is missing', () => {
    expect(
      getMissingSidecars({
        ...initialFormState(),
        adapterSelection: 'BgzipFastaAdapter',
        fastaLocation: fastaGz,
      }).map(s => s.ext),
    ).toEqual(['.fai', '.gzi'])
  })

  test('nothing for a 2bit', () => {
    expect(
      getMissingSidecars({
        ...initialFormState(),
        adapterSelection: 'TwoBitAdapter',
        twoBitLocation: twobit,
      }),
    ).toEqual([])
  })
})

describe('isFormReady', () => {
  test('false for a fresh form', () => {
    expect(isFormReady(initialFormState())).toBe(false)
  })

  test('false when a sequence is set but the name is whitespace-only', () => {
    expect(
      isFormReady({
        ...initialFormState(),
        adapterSelection: 'FastaAdapter',
        fastaLocation: fasta,
        assemblyName: '   ',
      }),
    ).toBe(false)
  })

  test('true once both a sequence and a real name are set', () => {
    expect(
      isFormReady({
        ...initialFormState(),
        adapterSelection: 'FastaAdapter',
        fastaLocation: fasta,
        assemblyName: 'hg38',
      }),
    ).toBe(true)
  })

  // getAdapterConfig throws on this form. Reporting it ready would put that
  // throw behind an enabled submit button.
  test('false while the chosen format is still missing an index', () => {
    expect(
      isFormReady({
        ...initialFormState(),
        adapterSelection: 'BgzipFastaAdapter',
        fastaLocation: fastaGz,
        assemblyName: 'hg38',
      }),
    ).toBe(false)
  })

  test('true once that index arrives', () => {
    expect(
      isFormReady({
        ...initialFormState(),
        adapterSelection: 'BgzipFastaAdapter',
        fastaLocation: fastaGz,
        faiLocation: fai,
        gziLocation: gzi,
        assemblyName: 'hg38',
      }),
    ).toBe(true)
  })
})

describe('isFormDirty', () => {
  test('false for a fresh form', () => {
    expect(isFormDirty(initialFormState())).toBe(false)
  })

  test('true for a sequence with no name yet', () => {
    expect(isFormDirty({ ...initialFormState(), fastaLocation: fasta })).toBe(
      true,
    )
  })

  test('true for a name with no sequence yet', () => {
    expect(isFormDirty({ ...initialFormState(), assemblyName: 'hg38' })).toBe(
      true,
    )
  })

  test('false for a whitespace-only name', () => {
    expect(isFormDirty({ ...initialFormState(), assemblyName: ' ' })).toBe(
      false,
    )
  })
})

describe('partitionExtraLocations', () => {
  test('a bgzipped FASTA uses both its indexes', () => {
    const { used, unused } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'BgzipFastaAdapter',
      fastaLocation: fastaGz,
      faiLocation: fai,
      gziLocation: gzi,
    })
    expect(used).toEqual([fai, gzi])
    expect(unused).toEqual([])
  })

  // getAdapterConfig reads chromSizes only for a 2bit, so a FASTA that lists it
  // as "also loading" is promising a file it drops
  test('a FASTA does not use chrom.sizes', () => {
    const { used, unused } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
      chromSizesLocation: chromSizes,
    })
    expect(used).toEqual([fai])
    expect(unused).toEqual([chromSizes])
  })

  test('a 2bit does not use a fai', () => {
    const { used, unused } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'TwoBitAdapter',
      twoBitLocation: twobit,
      chromSizesLocation: chromSizes,
      faiLocation: fai,
    })
    expect(used).toEqual([chromSizes])
    expect(unused).toEqual([fai])
  })

  test('aliases and cytobands reach every format', () => {
    const { used } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'FastaAdapter',
      fastaLocation: fasta,
      refNameAliasesLocation: aliases,
      cytobandsLocation: cytobands,
    })
    expect(used).toEqual([aliases, cytobands])
  })
})

describe('classifyLocations', () => {
  test('pairs each file with its role, undefined for one it cannot place', () => {
    const bam = {
      uri: 'https://example.com/x.bam',
      locationType: 'UriLocation',
    } as FileLocation
    expect(classifyLocations([fai, fasta, bam])).toEqual([
      { location: fai, role: 'fai' },
      { location: fasta, role: 'fasta' },
      { location: bam, role: undefined },
    ])
  })

  test('isSequenceRole picks out the sequences and leaves the sidecars', () => {
    expect(
      classifyLocations([fai, fasta, aliases])
        .filter(f => isSequenceRole(f.role))
        .map(f => f.location),
    ).toEqual([fasta])
  })
})

describe('buildAssemblyConf', () => {
  const resolveFastaAdapter = (fastaLocation: FileLocation) => ({
    type: 'UnindexedFastaAdapter' as const,
    fastaLocation,
  })

  test('trims the saved name and derives the trackId from it', async () => {
    const conf = await buildAssemblyConf(
      {
        ...initialFormState(),
        adapterSelection: 'IndexedFastaAdapter',
        fastaLocation: fasta,
        faiLocation: fai,
        assemblyName: '  hg38  ',
      },
      resolveFastaAdapter,
    )
    expect(conf.name).toBe('hg38')
    expect(conf.sequence.trackId.startsWith('hg38-')).toBe(true)
    expect(conf.sequence.type).toBe('ReferenceSequenceTrack')
    expect(conf.sequence.adapter).toEqual({
      type: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
    })
  })

  test('routes a plain FASTA through the injected resolver', async () => {
    const conf = await buildAssemblyConf(
      {
        ...initialFormState(),
        adapterSelection: 'FastaAdapter',
        fastaLocation: fasta,
        assemblyName: 'hg38',
      },
      resolveFastaAdapter,
    )
    expect(conf.sequence.adapter).toEqual({
      type: 'UnindexedFastaAdapter',
      fastaLocation: fasta,
    })
  })

  test('propagates a required-file error from getAdapterConfig', async () => {
    await expect(
      buildAssemblyConf(
        {
          ...initialFormState(),
          adapterSelection: 'IndexedFastaAdapter',
          fastaLocation: fasta,
          assemblyName: 'hg38',
        },
        resolveFastaAdapter,
      ),
    ).rejects.toThrow('Both FASTA and FAI locations are required')
  })
})

// A .chrom.sizes assembly: names and lengths, no bases. `jbrowse add-assembly`
// has inferred `--type chromSizes` from this extension for years; these pin the
// pane reaching the same config, and pin the one case the pane must NOT reach
// it — a 2bit that brought its chrom.sizes along as a sidecar.
describe('ChromSizesAdapter', () => {
  test('a lone .chrom.sizes is the primary file', () => {
    const form = applyPrimaryFile(initialFormState(), chromSizes)
    expect(form.adapterSelection).toBe('ChromSizesAdapter')
    expect(form.chromSizesLocation).toEqual(chromSizes)
    expect(form.assemblyName).toBe('hg38')
    expect(formHasSequence(form)).toBe(true)
    expect(isFormReady(form)).toBe(true)
  })

  test('detectAdapterType and the name strip the double extension', () => {
    expect(detectAdapterType('hg38.chrom.sizes')).toBe('ChromSizesAdapter')
    expect(getAssemblyNameFromFilename('hg38.chrom.sizes')).toBe('hg38')
  })

  test('builds a ChromSizesAdapter', () => {
    expect(
      getAdapterConfig({
        ...initialFormState(),
        adapterSelection: 'ChromSizesAdapter',
        chromSizesLocation: chromSizes,
      }),
    ).toEqual({
      kind: 'ready',
      adapter: { type: 'ChromSizesAdapter', chromSizesLocation: chromSizes },
    })
  })

  test('throws when the chrom.sizes is blank', () => {
    expect(() =>
      getAdapterConfig({
        ...initialFormState(),
        adapterSelection: 'ChromSizesAdapter',
      }),
    ).toThrow('Chromosome sizes location is required')
  })

  test('a dropped .chrom.sizes on its own leads', () => {
    const form = classifyAssemblyFiles([chromSizes])
    expect(form.adapterSelection).toBe('ChromSizesAdapter')
    expect(form.chromSizesLocation).toEqual(chromSizes)
    expect(form.assemblyName).toBe('hg38')
  })

  // the sabotage this pair is for: promoting chrom.sizes unconditionally turns
  // a 2bit drop into a sequence-free assembly, and every base-level view in it
  // goes quietly empty
  test('a 2bit alongside it keeps the 2bit as the sequence', () => {
    const form = classifyAssemblyFiles([twobit, chromSizes])
    expect(form.adapterSelection).toBe('TwoBitAdapter')
    expect(form.twoBitLocation).toEqual(twobit)
    expect(form.chromSizesLocation).toEqual(chromSizes)
  })

  test('a FASTA alongside it keeps the FASTA as the sequence', () => {
    const form = classifyAssemblyFiles([fasta, fai, chromSizes])
    expect(form.adapterSelection).toBe('IndexedFastaAdapter')
    expect(form.fastaLocation).toEqual(fasta)
  })

  test('the chrom.sizes is neither a used nor an unused extra', () => {
    const { used, unused } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'ChromSizesAdapter',
      chromSizesLocation: chromSizes,
    })
    expect(used).not.toContainEqual(chromSizes)
    expect(unused).not.toContainEqual(chromSizes)
  })

  test('under a FASTA it is still reported as dropped on the floor', () => {
    const { unused } = partitionExtraLocations({
      ...initialFormState(),
      adapterSelection: 'IndexedFastaAdapter',
      fastaLocation: fasta,
      faiLocation: fai,
      chromSizesLocation: chromSizes,
    })
    expect(unused).toContainEqual(chromSizes)
  })

  test('builds a whole assembly config', async () => {
    const conf = await buildAssemblyConf(
      {
        ...initialFormState(),
        adapterSelection: 'ChromSizesAdapter',
        chromSizesLocation: chromSizes,
        assemblyName: 'hg38',
      },
      () => {
        throw new Error('should not need a fasta index')
      },
    )
    expect(conf.sequence.adapter).toEqual({
      type: 'ChromSizesAdapter',
      chromSizesLocation: chromSizes,
    })
  })
})
