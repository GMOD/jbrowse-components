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
    expect(geneGlyphChipLabel(7)).toBe('Isoforms trimmed to fit')
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

// GeneGlyphControl draws its (×) only while `noticeShowing` (collapsed AND not
// dismissed). These pin the tooltip's minimize clause to that same term, which is
// the whole reason the builder is its own function.
describe('gene-glyph control tooltip', () => {
  it('offers the × exactly while the loud chip carries one', () => {
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        noticeShowing: true,
      }),
    ).toContain('× to minimize')
  })

  it('drops the × clause once the notice has been dismissed', () => {
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        noticeShowing: false,
      }),
    ).not.toContain('×')
  })

  // The regression: the control is the bare icon whenever transcripts are not
  // collapsed, dismissed or not, so a clause keyed on dismissal alone described
  // an affordance that mode never draws.
  it('drops the × clause when transcripts are not collapsed, undismissed', () => {
    const tooltip = geneGlyphTooltip({
      mode: 'all',
      collapsed: false,
      noticeShowing: false,
    })
    expect(tooltip).not.toContain('×')
    expect(tooltip).toBe('Showing all transcripts per gene. Click to change.')
  })

  // The collapse stopped being "the longest coding transcript" when the ranking
  // learned to read RefSeq Select / MANE Select — a tag outranks protein length,
  // so the tooltip must not promise a measurement it may not have made. With no
  // data loaded yet it can only state the rule.
  it('describes the collapse as one transcript, not the longest coding', () => {
    const tooltip = geneGlyphTooltip({
      mode: 'longestCoding',
      collapsed: true,
      noticeShowing: false,
    })
    expect(tooltip).toContain('one transcript per gene')
    expect(tooltip).toContain("annotation's representative one")
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
        noticeShowing: false,
      }),
    ).toContain(
      'one transcript per gene — 42 by MANE Select, 3 by RefSeq Select, 6 by longest coding',
    )
  })

  it('names one rule as a phrase when every gene agrees', () => {
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        picks: picks({ 'RefSeq Select': 12 }),
        noticeShowing: false,
      }),
    ).toContain('one transcript per gene — the RefSeq Select transcript')
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        picks: picks({}, 12),
        noticeShowing: false,
      }),
    ).toContain('one transcript per gene — the longest coding transcript')
  })

  it('says when the collapse was the zoom’s decision rather than the user’s', () => {
    expect(
      geneGlyphTooltip({ mode: 'auto', collapsed: true, noticeShowing: true }),
    ).toContain('chosen automatically at this zoom')
    expect(
      geneGlyphTooltip({
        mode: 'longestCoding',
        collapsed: true,
        noticeShowing: true,
      }),
    ).not.toContain('chosen automatically')
  })

  // The zoom collapse is undone by zooming in and the height cap by making the
  // track taller, so saying "at this zoom" for both sends a reader to the wrong
  // control.
  describe('the height cap', () => {
    it('names the number kept and what decided it', () => {
      const tooltip = geneGlyphTooltip({
        mode: 'auto',
        collapsed: true,
        maxIsoforms: 7,
        noticeShowing: true,
      })
      expect(tooltip).toContain('up to 7 transcripts per gene')
      expect(tooltip).toContain("as many as fit this track's height")
      expect(tooltip).not.toContain('at this zoom')
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
          noticeShowing: true,
        }),
      ).toContain(
        "as many as fit this track's height, fewer where genes stack, MANE Select first",
      )
    })

    // The cap exists only under Auto, so "All transcripts" lifts it, and it is
    // sized to the track — neither lever is visible from the menu's three
    // options, and the corner control that changes the height is next door.
    it('names both levers that admit more', () => {
      const tooltip = geneGlyphTooltip({
        mode: 'auto',
        collapsed: true,
        maxIsoforms: 7,
        noticeShowing: true,
      })
      expect(tooltip).toContain(
        'Click to change — a taller track, or All transcripts, shows more; × to minimize',
      )
      expect(
        geneGlyphTooltip({
          mode: 'longestCoding',
          collapsed: true,
          noticeShowing: true,
        }),
      ).not.toContain('taller track')
    })

    it('singularizes a cap of one', () => {
      expect(
        geneGlyphTooltip({
          mode: 'auto',
          collapsed: true,
          maxIsoforms: 1,
          noticeShowing: false,
        }),
      ).toContain('up to 1 transcript per gene')
    })

    // the model passes `maxIsoforms` only when a gene actually lost isoforms
    it('says nothing about a cap while every gene fits', () => {
      expect(
        geneGlyphTooltip({
          mode: 'auto',
          collapsed: false,
          noticeShowing: false,
        }),
      ).toBe('Showing all transcripts per gene. Click to change.')
    })
  })
})
