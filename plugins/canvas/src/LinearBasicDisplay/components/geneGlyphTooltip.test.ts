import { geneGlyphTooltip } from './geneGlyphTooltip.ts'

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
  // so the tooltip must not promise a measurement it may not have made.
  it('describes the collapse as one transcript, not the longest coding', () => {
    const tooltip = geneGlyphTooltip({
      mode: 'longestCoding',
      collapsed: true,
      noticeShowing: false,
    })
    expect(tooltip).toContain('one transcript per gene')
    expect(tooltip).toContain("annotation's representative one")
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
