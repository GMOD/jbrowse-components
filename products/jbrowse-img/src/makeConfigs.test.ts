import { makeFastaAssembly, makeSyntenyTrackConfig } from './makeConfigs.ts'

// makeLocation / makeTrackConfig / readData are covered in renderRegion.test.ts;
// these target the two config builders that file doesn't exercise.

describe('makeSyntenyTrackConfig', () => {
  test.each([
    ['paf', 'PAFAdapter', 'pafLocation'],
    ['delta', 'DeltaAdapter', 'deltaLocation'],
    ['chain', 'ChainAdapter', 'chainLocation'],
    ['blasttab', 'BlastTabularAdapter', 'blastTableLocation'],
  ])('%s → %s on slot %s', (type, adapterType, locSlot) => {
    const t = makeSyntenyTrackConfig(type, `aln.${type}`, 'qry', 'tgt')
    expect(t.type).toBe('SyntenyTrack')
    expect(t.trackId).toBe(`aln.${type}`)
    expect(t.adapter.type).toBe(adapterType)
    expect(t.adapter[locSlot]).toEqual({ localPath: `aln.${type}` })
  })

  test('assemblyNames are [query, target] on both track and adapter', () => {
    const t = makeSyntenyTrackConfig('paf', 'a.paf', 'query', 'target')
    expect(t.assemblyNames).toEqual(['query', 'target'])
    expect(t.adapter.assemblyNames).toEqual(['query', 'target'])
  })

  test('a remote comparison file uses a uri location', () => {
    const t = makeSyntenyTrackConfig('paf', 'https://e.com/a.paf', 'q', 't')
    expect(t.adapter.pafLocation).toEqual({ uri: 'https://e.com/a.paf' })
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
      location: { localPath: 'cyto.bed' },
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
