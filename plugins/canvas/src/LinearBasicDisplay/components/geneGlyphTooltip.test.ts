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
})
