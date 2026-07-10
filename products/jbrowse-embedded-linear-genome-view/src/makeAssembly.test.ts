import {
  assemblyNameFromUri,
  isSequenceUri,
  makeAssembly,
} from './makeAssembly.ts'

describe('makeAssembly', () => {
  // makeAssembly emits the flat `{ name, uri }` shorthand; core's assembly config
  // expands it, picks the concrete adapter type (Indexed/Bgzip/TwoBit), and
  // derives the .fai/.gzi siblings at load time (covered by the sequence plugin's
  // guesser tests).
  it('emits the flat { name, uri } shorthand for a plain FASTA', () => {
    const a = makeAssembly({ name: 'volvox', fastaUri: 'volvox.fa' })
    expect(a).toEqual({ name: 'volvox', aliases: [], uri: 'volvox.fa' })
    // no sequence track or adapter type is baked in here — that is core's job
    expect('sequence' in a).toBe(false)
    expect('refNameAliases' in a).toBe(false)
  })

  it('passes a bgzipped FASTA through as a flat uri too', () => {
    const a = makeAssembly({ name: 'hg38', fastaUri: 'hg38.fa.gz' })
    expect(a).toEqual({ name: 'hg38', aliases: [], uri: 'hg38.fa.gz' })
  })

  it('widens to the adapter form for a non-sibling index, with aliases', () => {
    const a = makeAssembly({
      name: 'hg38',
      fastaUri: 'hg38.fa',
      faiUri: 'elsewhere.fai',
      aliases: ['GRCh38'],
      refNameAliasesUri: 'aliases.txt',
    })
    // a non-sibling index has no home in the flat shape, so it falls back to the
    // sequence.adapter form; the bare uri there still infers the adapter type,
    // and the explicit faiLocation overrides the guessed sibling
    expect(a).toEqual({
      name: 'hg38',
      aliases: ['GRCh38'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'hg38-ReferenceSequenceTrack',
        adapter: { uri: 'hg38.fa', faiLocation: { uri: 'elsewhere.fai' } },
      },
      refNameAliases: { uri: 'aliases.txt' },
    })
  })

  it('derives the name from the uri when omitted', () => {
    const a = makeAssembly({ fastaUri: 'https://x.test/data/hg38.fa.gz?t=1' })
    expect(a.name).toBe('hg38')
    expect(a.uri).toBe('https://x.test/data/hg38.fa.gz?t=1')
  })

  it('passes a .2bit through as a flat uri', () => {
    const a = makeAssembly({ fastaUri: 'hg38.2bit' })
    expect(a).toEqual({ name: 'hg38', aliases: [], uri: 'hg38.2bit' })
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
