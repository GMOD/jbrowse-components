import {
  makeChromSizesAssembly,
  makeFastaAssembly,
  makeMultiWiggleTrackConfig,
  makeSyntenyTrackConfig,
} from './makeConfigs.ts'

// makeLocation / makeTrackConfig / readData are covered in renderRegion.test.ts;
// these target the two config builders that file doesn't exercise.

describe('makeSyntenyTrackConfig', () => {
  test.each([
    ['paf', 'PAFAdapter', 'pafLocation'],
    ['delta', 'DeltaAdapter', 'deltaLocation'],
    ['chain', 'ChainAdapter', 'chainLocation'],
    ['blasttab', 'BlastTabularAdapter', 'blastTableLocation'],
  ])('%s → %s on slot %s', (type, adapterType, locSlot) => {
    const t = makeSyntenyTrackConfig(type, `aln.${type}`, 'upper', 'lower')
    expect(t.type).toBe('SyntenyTrack')
    expect(t.trackId).toBe(`aln.${type}`)
    expect(t.adapter?.type).toBe(adapterType)
    expect(t.adapter?.[locSlot]).toEqual({ localPath: `aln.${type}` })
  })

  // PAF/BLAST list the query first, so the upper (first) assembly is the query.
  test('paf: upper assembly is the query, lower is the target', () => {
    const t = makeSyntenyTrackConfig('paf', 'a.paf', 'upper', 'lower')
    expect(t.adapter?.queryAssembly).toBe('upper')
    expect(t.adapter?.targetAssembly).toBe('lower')
    expect(t.assemblyNames).toEqual(['upper', 'lower'])
  })

  // A chain/delta liftover maps target→query, so the upper assembly is the
  // target — the opposite of PAF. This is the orientation that's easy to get
  // backwards.
  test('chain: upper assembly is the target, lower is the query', () => {
    const t = makeSyntenyTrackConfig('chain', 'a.chain', 'upper', 'lower')
    expect(t.adapter?.queryAssembly).toBe('lower')
    expect(t.adapter?.targetAssembly).toBe('upper')
    expect(t.assemblyNames).toEqual(['lower', 'upper'])
  })

  test('a remote comparison file uses a uri location', () => {
    const t = makeSyntenyTrackConfig('paf', 'https://e.com/a.paf', 'q', 't')
    expect(t.adapter?.pafLocation).toEqual({ uri: 'https://e.com/a.paf' })
  })
})

describe('makeFastaAssembly', () => {
  test('plain fasta → IndexedFastaAdapter with fai and no gzi', () => {
    const a = makeFastaAssembly('genome.fa', undefined, undefined, 'rs')
    expect(a.name).toBe('genome.fa')
    expect(a.sequence.trackId).toBe('rs')
    expect(a.sequence.adapter).toMatchObject({
      type: 'IndexedFastaAdapter',
      fastaLocation: { localPath: 'genome.fa' },
      faiLocation: { localPath: 'genome.fa.fai' },
      gziLocation: undefined,
    })
  })

  test('bgzipped fasta → BgzipFastaAdapter with a gzi location', () => {
    const a = makeFastaAssembly('genome.fa.gz', undefined, undefined, 'rs')
    expect(a.sequence.adapter).toMatchObject({
      type: 'BgzipFastaAdapter',
      faiLocation: { localPath: 'genome.fa.gz.fai' },
      gziLocation: { localPath: 'genome.fa.gz.gzi' },
    })
  })

  test('aliases attach a RefNameAliasAdapter only when provided', () => {
    expect(
      makeFastaAssembly('g.fa', undefined, undefined, 'rs').refNameAliases,
    ).toBeUndefined()
    const a = makeFastaAssembly('g.fa', 'aliases.txt', undefined, 'rs')
    expect(a.refNameAliases?.adapter).toMatchObject({
      type: 'RefNameAliasAdapter',
      location: { localPath: 'aliases.txt' },
    })
  })

  test('cytobands attach a CytobandAdapter only when provided', () => {
    expect(
      makeFastaAssembly('g.fa', undefined, undefined, 'rs').cytobands,
    ).toBeUndefined()
    const a = makeFastaAssembly('g.fa', undefined, 'cyto.bed', 'rs')
    expect(a.cytobands?.adapter).toMatchObject({
      type: 'CytobandAdapter',
      cytobandLocation: { localPath: 'cyto.bed' },
    })
  })

  test('a remote fasta uses uri locations for fasta + fai', () => {
    const a = makeFastaAssembly(
      'https://e.com/g.fa',
      undefined,
      undefined,
      'rs',
    )
    expect(a.sequence.adapter).toMatchObject({
      fastaLocation: { uri: 'https://e.com/g.fa' },
      faiLocation: { uri: 'https://e.com/g.fa.fai' },
    })
  })
})

describe('makeChromSizesAssembly', () => {
  test('chrom.sizes → ChromSizesAdapter (no sequence file)', () => {
    const a = makeChromSizesAssembly(
      'hg38.chrom.sizes',
      undefined,
      undefined,
      'rs',
    )
    // the `.chrom.sizes` extension is stripped from the display name
    expect(a.name).toBe('hg38')
    expect(a.sequence.adapter).toEqual({
      type: 'ChromSizesAdapter',
      chromSizesLocation: { localPath: 'hg38.chrom.sizes' },
    })
  })

  test('shares the aliases/cytobands attach logic', () => {
    const a = makeChromSizesAssembly('a.sizes', 'al.txt', 'cyto.bed', 'rs')
    expect(a.refNameAliases?.adapter).toMatchObject({
      location: { localPath: 'al.txt' },
    })
    expect(a.cytobands?.adapter).toMatchObject({
      cytobandLocation: { localPath: 'cyto.bed' },
    })
  })
})

describe('makeMultiWiggleTrackConfig', () => {
  const asm = makeFastaAssembly('hg38.fa', undefined, undefined, 'rs')

  // A plain string array becomes one BigWigAdapter subadapter per file, the
  // location run through makeLocation so a URL is a `uri`...
  test('URL string sources → subadapters with uri locations', () => {
    const t = makeMultiWiggleTrackConfig(
      ['https://e.com/a.bw', 'https://e.com/b.bw'],
      'sources.json',
      asm,
    )
    expect(t.type).toBe('MultiQuantitativeTrack')
    expect(t.trackId).toBe('sources.json')
    expect(t.assemblyNames).toEqual([asm.name])
    expect(t.adapter).toEqual({
      type: 'MultiWiggleAdapter',
      subadapters: [
        {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: 'https://e.com/a.bw' },
        },
        {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: 'https://e.com/b.bw' },
        },
      ],
    })
    expect(t.adapter?.bigWigs).toBeUndefined()
  })

  // ...and a LOCAL path is a `localPath` (the `bigWigs` shorthand could only ever
  // make a `uri`, so a local file used to 404 — see makeMultiWiggleTrackConfig).
  test('local path string sources → subadapters with localPath locations', () => {
    const t = makeMultiWiggleTrackConfig(['data/a.bw'], 'a.bw', asm)
    expect(t.adapter).toEqual({
      type: 'MultiWiggleAdapter',
      subadapters: [
        { type: 'BigWigAdapter', bigWigLocation: { localPath: 'data/a.bw' } },
      ],
    })
  })

  // Subadapter objects (name/color/group per row) pass through as `subadapters`,
  // so a curated track keeps its per-row metadata.
  test('object sources → subadapters', () => {
    const subs = [
      {
        type: 'BigWigAdapter',
        name: 'Alpha',
        color: '#e6194b',
        bigWigLocation: { uri: 'https://e.com/alpha.bw' },
      },
    ]
    const t = makeMultiWiggleTrackConfig(subs, 'catlas.json', asm)
    expect(t.adapter).toEqual({
      type: 'MultiWiggleAdapter',
      subadapters: subs,
    })
    expect(t.adapter?.bigWigs).toBeUndefined()
  })
})
