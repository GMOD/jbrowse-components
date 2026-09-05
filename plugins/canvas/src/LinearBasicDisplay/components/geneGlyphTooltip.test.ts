import { geneGlyphChipLabel, geneGlyphTooltip } from './geneGlyphTooltip.ts'

const picks = (byTag: Record<string, number>, byLength = 0) => ({
  byTag,
  byLength,
  byCap: 0,
})

describe('gene-glyph chip label', () => {
  it('names the rule, never a count', () => {
    expect(geneGlyphChipLabel(7)).toBe('Isoforms trimmed')
    expect(geneGlyphChipLabel(7)).not.toMatch(/\d/)
  })

  // The model only hands over a cap that hid something, so a cap of one arrives
  // with the picks it made.
  it('spells a cap of one as the collapse it is', () => {
    expect(geneGlyphChipLabel(1, picks({}, 4))).toBe('Longest isoform')
    expect(geneGlyphChipLabel(1, picks({ 'MANE Select': 4 }))).toBe(
      'MANE Select',
    )
  })

  it('names the rule that picked the transcript, not the count', () => {
    expect(geneGlyphChipLabel(undefined, picks({ 'RefSeq Select': 12 }))).toBe(
      'RefSeq Select',
    )
    expect(geneGlyphChipLabel(undefined, picks({}, 12))).toBe('Longest isoform')
  })

  it('says only the count while nothing has reported a pick yet', () => {
    expect(geneGlyphChipLabel(undefined)).toBe('One isoform')
    expect(geneGlyphChipLabel(undefined, picks({}))).toBe('One isoform')
  })

  // A window mixing tagged and untagged genes is normal: NCBI tags its
  // protein-coding genes and leaves most non-coding ones alone.
  it('takes the commonest tag when a window holds several', () => {
    expect(
      geneGlyphChipLabel(
        undefined,
        picks({ 'RefSeq Select': 3, 'MANE Select': 9 }, 4),
      ),
    ).toBe('MANE Select')
  })
})

describe('gene-glyph control tooltip', () => {
  it('says only what is on screen when nothing is collapsed', () => {
    expect(geneGlyphTooltip({ mode: 'all', collapsed: false })).toBe(
      'All transcripts per gene.',
    )
  })

  // A tag outranks protein length in the ranking, so the tooltip must not promise
  // a measurement it may not have made.
  it('describes the collapse as one transcript, not the longest coding', () => {
    expect(geneGlyphTooltip({ mode: 'longestCoding', collapsed: true })).toBe(
      'One transcript per gene.',
    )
  })

  it('names one rule when every gene agrees', () => {
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        picks: picks({ 'RefSeq Select': 12 }),
      }),
    ).toBe('One transcript per gene (RefSeq Select).')
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        picks: picks({}, 12),
      }),
    ).toBe('One transcript per gene (longest coding).')
  })

  // The length fallback sorts last however common it is: reading it first says
  // the annotation names nothing, when it named 45 here.
  it('spends the whole breakdown once the genes on screen disagree', () => {
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        picks: picks({ 'MANE Select': 42, 'RefSeq Select': 3 }, 6),
      }),
    ).toBe(
      'One transcript per gene (42 MANE Select, 3 RefSeq Select, 6 longest coding).',
    )
  })

  it('says when the collapse was the zoom’s decision, and how to undo it', () => {
    expect(geneGlyphTooltip({ mode: 'auto', collapsed: true })).toBe(
      'One transcript per gene, chosen by zoom. Zoom in for all.',
    )
    expect(
      geneGlyphTooltip({ mode: 'longestCoding', collapsed: true }),
    ).not.toContain('zoom')
  })

  // A taller track or lifting the cap undoes it, never the zoom, which would send
  // a reader to the wrong control.
  describe('the height cap', () => {
    it('names the number kept and both levers', () => {
      expect(
        geneGlyphTooltip({ mode: 'auto', collapsed: true, maxIsoforms: 7 }),
      ).toBe(
        'Up to 7 transcripts per gene fit this height. A taller track or All transcripts shows more.',
      )
    })

    it('names the tag the kept transcripts lead with', () => {
      expect(
        geneGlyphTooltip({
          mode: 'auto',
          collapsed: true,
          maxIsoforms: 7,
          picks: picks({ 'MANE Select': 9 }, 2),
        }),
      ).toContain('fit this height (MANE Select first).')
    })

    it('singularizes a cap of one', () => {
      expect(
        geneGlyphTooltip({ mode: 'auto', collapsed: true, maxIsoforms: 1 }),
      ).toContain('Up to 1 transcript per gene')
    })

    // The model passes `maxIsoforms` only when a gene actually lost isoforms.
    it('says nothing about a cap while every gene fits', () => {
      expect(geneGlyphTooltip({ mode: 'auto', collapsed: false })).toBe(
        'All transcripts per gene.',
      )
    })
  })
})
