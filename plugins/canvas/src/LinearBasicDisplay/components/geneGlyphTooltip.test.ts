import { geneGlyphChipLabel, geneGlyphTooltip } from './geneGlyphTooltip.ts'

const picks = (byTag: Record<string, number>, byLength = 0) => ({
  byTag,
  byLength,
  byCap: 0,
})

describe('gene-glyph chip label', () => {
  // The cap's chip names the RULE, not a count. It read "Top 7 isoforms" — the
  // number KEPT, which is the one number a reader gets from looking at any gene
  // on screen, and which says nothing about how many are missing from each. That
  // number is per-gene and is now on each gene's own label
  // (`moreIsoformsLabel`), so nothing here restates it.
  it('names the rule, never a count', () => {
    expect(geneGlyphChipLabel(7)).toBe('Isoforms trimmed')
    expect(geneGlyphChipLabel(7)).not.toMatch(/\d/)
  })

  // a very short lane resolves the row budget to 1, which read "Top 1 isoforms".
  // The model only ever hands over a cap that hid something, so a cap of one
  // arrives with the picks it made.
  it('spells a cap of one as the collapse it is', () => {
    expect(geneGlyphChipLabel(1, picks({}, 4))).toBe('Longest isoform')
    expect(geneGlyphChipLabel(1, picks({ 'MANE Select': 4 }))).toBe(
      'MANE Select',
    )
  })

  // "One isoform" said only that transcripts were missing. The reader's question
  // about the one on screen is which one it is, and for a tagged annotation the
  // answer is the annotation's own word.
  it('names the rule that picked the transcript, not the count', () => {
    expect(geneGlyphChipLabel(undefined, picks({ 'RefSeq Select': 12 }))).toBe(
      'RefSeq Select',
    )
    expect(geneGlyphChipLabel(undefined, picks({}, 12))).toBe('Longest isoform')
  })

  // The mode turns the chip loud on the main thread; which rule picked what
  // arrives a fetch later. Between the two — zooming past `auto`'s threshold, or
  // picking Representative from the chip's own menu — the loaded data is the
  // previous mode's and has reported no pick, and "Longest isoform" there is
  // wrong for the whole fetch on any tagged annotation.
  it('says only the count while nothing has reported a pick yet', () => {
    expect(geneGlyphChipLabel(undefined)).toBe('One isoform')
    expect(geneGlyphChipLabel(undefined, picks({}))).toBe('One isoform')
  })

  // A window mixing tagged and untagged genes is normal — NCBI tags its
  // protein-coding genes and leaves most non-coding ones alone — and the chip
  // has room for one rule, so it takes the commonest and the tooltip carries the
  // rest.
  it('takes the commonest tag when a window holds several', () => {
    expect(
      geneGlyphChipLabel(
        undefined,
        picks({ 'RefSeq Select': 3, 'MANE Select': 9 }, 4),
      ),
    ).toBe('MANE Select')
  })
})

// The tooltip is the chip's footnote: one sentence for what is on screen, one
// for the lever. No "click to change" — the ▾ on the chip says that — and no
// dismissal clause, since opening the menu is the acknowledgement.
describe('gene-glyph control tooltip', () => {
  it('says only what is on screen when nothing is collapsed', () => {
    expect(geneGlyphTooltip({ mode: 'all', collapsed: false })).toBe(
      'All transcripts per gene.',
    )
  })

  // The collapse stopped being "the longest coding transcript" when the ranking
  // learned to read RefSeq Select / MANE Select — a tag outranks protein length,
  // so the tooltip must not promise a measurement it may not have made. With no
  // data loaded yet it can only state the rule.
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

  // The chip has room for the commonest rule alone, so the mixture is visible
  // here or nowhere. The length fallback sorts last however common it is —
  // reading it first says the annotation names nothing, when it named 45 here.
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

  // The zoom collapse is undone by zooming in, so that is the lever it names;
  // a mode the user picked names none.
  it('says when the collapse was the zoom’s decision, and how to undo it', () => {
    expect(geneGlyphTooltip({ mode: 'auto', collapsed: true })).toBe(
      'One transcript per gene, chosen by zoom. Zoom in for all.',
    )
    expect(
      geneGlyphTooltip({ mode: 'longestCoding', collapsed: true }),
    ).not.toContain('zoom')
  })

  // The height cap is undone by making the track taller or lifting the cap
  // (it exists only under Auto), so those are the levers it names — never the
  // zoom, which sends a reader to the wrong control.
  describe('the height cap', () => {
    it('names the number kept and both levers', () => {
      expect(
        geneGlyphTooltip({ mode: 'auto', collapsed: true, maxIsoforms: 7 }),
      ).toBe(
        'Up to 7 transcripts per gene fit this height. A taller track or All transcripts shows more.',
      )
    })

    // The cap keeps the top n of the same ranking the collapse takes the head
    // of, so which n it kept is the same answer, one clause shorter.
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

    // the model passes `maxIsoforms` only when a gene actually lost isoforms
    it('says nothing about a cap while every gene fits', () => {
      expect(geneGlyphTooltip({ mode: 'auto', collapsed: false })).toBe(
        'All transcripts per gene.',
      )
    })
  })
})
