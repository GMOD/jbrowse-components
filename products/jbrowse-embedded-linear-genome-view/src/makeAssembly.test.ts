import { makeAssembly } from './makeAssembly.ts'

describe('makeAssembly', () => {
  it('uses IndexedFastaAdapter and a default .fai for a plain FASTA', () => {
    const a = makeAssembly({ name: 'volvox', fastaUri: 'volvox.fa' })
    expect(a).toMatchObject({
      name: 'volvox',
      aliases: [],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox-ReferenceSequenceTrack',
        adapter: {
          type: 'IndexedFastaAdapter',
          uri: 'volvox.fa',
          faiLocation: { uri: 'volvox.fa.fai' },
        },
      },
    })
    expect('gziLocation' in a.sequence.adapter).toBe(false)
    expect('refNameAliases' in a).toBe(false)
  })

  it('uses BgzipFastaAdapter and a default .gzi for a bgzipped FASTA', () => {
    const a = makeAssembly({ name: 'hg38', fastaUri: 'hg38.fa.gz' })
    expect(a.sequence.adapter).toMatchObject({
      type: 'BgzipFastaAdapter',
      faiLocation: { uri: 'hg38.fa.gz.fai' },
      gziLocation: { uri: 'hg38.fa.gz.gzi' },
    })
  })

  it('honors explicit index uris and refName aliases', () => {
    const a = makeAssembly({
      name: 'hg38',
      fastaUri: 'hg38.fa',
      faiUri: 'elsewhere.fai',
      aliases: ['GRCh38'],
      refNameAliasesUri: 'aliases.txt',
    })
    expect(a.sequence.adapter.faiLocation).toEqual({ uri: 'elsewhere.fai' })
    expect(a.aliases).toEqual(['GRCh38'])
    expect(a.refNameAliases).toEqual({
      adapter: { type: 'RefNameAliasAdapter', uri: 'aliases.txt' },
    })
  })
})
