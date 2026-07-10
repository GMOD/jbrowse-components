import {
  assemblyNameFromUri,
  isSequenceUri,
  makeAssembly,
} from './makeAssembly.ts'

describe('makeAssembly', () => {
  // makeAssembly emits the bare `uri` shorthand; core's assembly config picks
  // the concrete adapter type (Indexed/Bgzip/TwoBit) and derives the .fai/.gzi
  // siblings at load time (covered by the sequence plugin's guesser tests).
  it('emits a uri-shorthand sequence adapter for a plain FASTA', () => {
    const a = makeAssembly({ name: 'volvox', fastaUri: 'volvox.fa' })
    expect(a).toMatchObject({
      name: 'volvox',
      aliases: [],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox-ReferenceSequenceTrack',
        adapter: { uri: 'volvox.fa' },
      },
    })
    // no adapter type is baked in here — that is core's job
    expect('type' in a.sequence.adapter).toBe(false)
    expect('refNameAliases' in a).toBe(false)
  })

  it('passes a bgzipped FASTA through as a bare uri too', () => {
    const a = makeAssembly({ name: 'hg38', fastaUri: 'hg38.fa.gz' })
    expect(a.sequence.adapter).toEqual({ uri: 'hg38.fa.gz' })
  })

  it('honors explicit index uris and refName aliases', () => {
    const a = makeAssembly({
      name: 'hg38',
      fastaUri: 'hg38.fa',
      faiUri: 'elsewhere.fai',
      aliases: ['GRCh38'],
      refNameAliasesUri: 'aliases.txt',
    })
    // a non-sibling faiLocation rides on the shorthand and overrides the
    // guessed sibling once core infers the type
    expect(a.sequence.adapter).toEqual({
      uri: 'hg38.fa',
      faiLocation: { uri: 'elsewhere.fai' },
    })
    expect(a.aliases).toEqual(['GRCh38'])
    expect(a.refNameAliases).toEqual({
      adapter: { type: 'RefNameAliasAdapter', uri: 'aliases.txt' },
    })
  })

  it('derives the name from the uri when omitted', () => {
    const a = makeAssembly({ fastaUri: 'https://x.test/data/hg38.fa.gz?t=1' })
    expect(a.name).toBe('hg38')
    expect(a.sequence.trackId).toBe('hg38-ReferenceSequenceTrack')
  })

  it('passes a .2bit through as a bare uri', () => {
    const a = makeAssembly({ fastaUri: 'hg38.2bit' })
    expect(a.name).toBe('hg38')
    expect(a.sequence.adapter).toEqual({ uri: 'hg38.2bit' })
  })
})

describe('isSequenceUri', () => {
  it('recognizes sequence files and rejects hub names and other data', () => {
    expect(isSequenceUri('hg38.fa')).toBe(true)
    expect(isSequenceUri('hg38.fasta.gz')).toBe(true)
    expect(isSequenceUri('genome.2bit')).toBe(true)
    expect(isSequenceUri('https://x.test/hg38.fa.gz?token=y')).toBe(true)
    expect(isSequenceUri('hg38')).toBe(false)
    expect(isSequenceUri('GCF_000001405.40')).toBe(false)
    expect(isSequenceUri('reads.bam')).toBe(false)
  })
})

describe('assemblyNameFromUri', () => {
  it('strips path and sequence extension', () => {
    expect(assemblyNameFromUri('https://x.test/data/hg19.fa.gz')).toBe('hg19')
    expect(assemblyNameFromUri('volvox.2bit')).toBe('volvox')
  })
})
