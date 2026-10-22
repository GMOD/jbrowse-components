import { genomeAssembly } from '@jbrowse/launch-args'

import { makeMultiWiggleTrackConfig } from './makeConfigs.ts'

describe('genomeAssembly --fasta', () => {
  test('plain fasta → IndexedFastaAdapter with fai and no gzi', () => {
    const a = genomeAssembly('fasta', ['genome.fa'], 'rs').assembly
    expect(a.name).toBe('genome.fa')
    expect(a.sequence.trackId).toBe('rs')
    expect(a.sequence.adapter).toMatchObject({
      type: 'IndexedFastaAdapter',
      fastaLocation: { localPath: 'genome.fa' },
      faiLocation: { localPath: 'genome.fa.fai' },
    })
    expect(a.sequence.adapter).not.toHaveProperty('gziLocation')
  })

  test('bgzipped fasta → BgzipFastaAdapter with a gzi location', () => {
    const a = genomeAssembly('fasta', ['genome.fa.gz'], 'rs').assembly
    expect(a.sequence.adapter).toMatchObject({
      type: 'BgzipFastaAdapter',
      faiLocation: { localPath: 'genome.fa.gz.fai' },
      gziLocation: { localPath: 'genome.fa.gz.gzi' },
    })
  })

  test('a .GZ fasta is bgzipped too', () => {
    const a = genomeAssembly('fasta', ['genome.fa.GZ'], 'rs').assembly
    expect(a.sequence.adapter).toMatchObject({
      type: 'BgzipFastaAdapter',
      gziLocation: { localPath: 'genome.fa.GZ.gzi' },
    })
  })

  test('a name merely ending in the letters gz is not bgzipped', () => {
    const a = genomeAssembly('fasta', ['genome.fagz'], 'rs').assembly
    expect(a.sequence.adapter).toMatchObject({ type: 'IndexedFastaAdapter' })
    expect(a.sequence.adapter).not.toHaveProperty('gziLocation')
  })

  test('aliases attach a RefNameAliasAdapter only when provided', () => {
    expect(
      genomeAssembly('fasta', ['g.fa'], 'rs').assembly.refNameAliases,
    ).toBeUndefined()
    const a = genomeAssembly(
      'fasta',
      ['g.fa', 'aliases:aliases.txt'],
      'rs',
    ).assembly
    expect(a.refNameAliases?.adapter).toMatchObject({
      type: 'RefNameAliasAdapter',
      location: { localPath: 'aliases.txt' },
    })
  })

  test('cytobands attach a CytobandAdapter only when provided', () => {
    expect(
      genomeAssembly('fasta', ['g.fa'], 'rs').assembly.cytobands,
    ).toBeUndefined()
    const a = genomeAssembly(
      'fasta',
      ['g.fa', 'cytobands:cyto.bed'],
      'rs',
    ).assembly
    expect(a.cytobands?.adapter).toMatchObject({
      type: 'CytobandAdapter',
      cytobandLocation: { localPath: 'cyto.bed' },
    })
  })

  test('a remote fasta uses uri locations for fasta + fai', () => {
    const a = genomeAssembly('fasta', ['https://e.com/g.fa'], 'rs').assembly
    expect(a.sequence.adapter).toMatchObject({
      fastaLocation: { uri: 'https://e.com/g.fa' },
      faiLocation: { uri: 'https://e.com/g.fa.fai' },
    })
  })
})

describe('genomeAssembly --chromSizes', () => {
  test('chrom.sizes → ChromSizesAdapter (no sequence file)', () => {
    const a = genomeAssembly('chromSizes', ['hg38.chrom.sizes'], 'rs').assembly
    // the `.chrom.sizes` extension is stripped from the display name
    expect(a.name).toBe('hg38')
    expect(a.sequence.adapter).toEqual({
      type: 'ChromSizesAdapter',
      chromSizesLocation: {
        localPath: 'hg38.chrom.sizes',
        locationType: 'LocalPathLocation',
      },
    })
  })

  test('shares the aliases/cytobands attach logic', () => {
    const a = genomeAssembly(
      'chromSizes',
      ['a.sizes', 'aliases:al.txt', 'cytobands:cyto.bed'],
      'rs',
    ).assembly
    expect(a.refNameAliases?.adapter).toMatchObject({
      location: { localPath: 'al.txt' },
    })
    expect(a.cytobands?.adapter).toMatchObject({
      cytobandLocation: { localPath: 'cyto.bed' },
    })
  })
})

describe('makeMultiWiggleTrackConfig', () => {
  const asm = genomeAssembly('fasta', ['hg38.fa'], 'rs').assembly

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
          bigWigLocation: {
            uri: 'https://e.com/a.bw',
            locationType: 'UriLocation',
          },
        },
        {
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://e.com/b.bw',
            locationType: 'UriLocation',
          },
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
        {
          type: 'BigWigAdapter',
          bigWigLocation: {
            localPath: 'data/a.bw',
            locationType: 'LocalPathLocation',
          },
        },
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
