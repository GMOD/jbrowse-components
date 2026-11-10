import { withWordTails, wordTails } from './wordTails.ts'

async function collect(lines: string[]) {
  const out = await Array.fromAsync(
    withWordTails(
      (async function* () {
        yield* lines
      })(),
    ),
  )
  return out
}

describe('wordTails', () => {
  it('gives the rest of a name from each punctuation mark', () => {
    expect(wordTails('HLA-DRB1-AS1')).toEqual(['drb1-as1', 'as1'])
  })

  it('gives nothing for an accession, whose pieces are digits', () => {
    expect(wordTails('NM_000059.4')).toEqual([])
  })

  it('skips a piece of one or two characters', () => {
    expect(wordTails('HLA-A')).toEqual([])
    expect(wordTails('MT-ND1')).toEqual(['nd1'])
  })

  it('reaches the id behind a prefix', () => {
    expect(wordTails('transcript:ENST00000380152')).toEqual(['enst00000380152'])
  })

  it('gives nothing for a word with no punctuation', () => {
    expect(wordTails('BRCA2')).toEqual([])
  })
})

describe('withWordTails', () => {
  it('adds a line for a tail, after the lines it was given', async () => {
    expect(await collect(['r1 HLA-DRB1\n', 'r2 BRCA2\n'])).toEqual([
      'r1 HLA-DRB1\n',
      'r2 BRCA2\n',
      'r1 drb1\n',
    ])
  })

  it('drops a tail more than 100 records share, keeping the rare ones', async () => {
    const lines = Array.from({ length: 101 }, (_, i) => `r${i} GENE${i}-AS1\n`)
    expect(await collect([...lines, 'x HLA-DRB1\n'])).toEqual([
      ...lines,
      'x HLA-DRB1\n',
      'x drb1\n',
    ])
  })

  it('keeps a tail exactly 100 records share', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `r${i} GENE${i}-AS1\n`)
    expect(await collect(lines)).toHaveLength(200)
  })

  it('adds no line for a tail the record already carries as a word', async () => {
    expect(await collect(['r1 gene-BRCA2 BRCA2\n'])).toEqual([
      'r1 gene-BRCA2 BRCA2\n',
    ])
  })
})
