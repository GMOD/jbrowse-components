import { formatSashimiLocation } from './tooltipUtils.ts'

describe('formatSashimiLocation', () => {
  // The junction start is stored 0-based half-open; the tooltip must render it
  // 1-based (start + 1) to agree with formatCigarTooltip/formatLocation and the
  // detail widget (openSashimiWidget stores the raw start, shown as start + 1).
  it('renders the start 1-based and the end as-is', () => {
    expect(formatSashimiLocation('chr1', 1000, 2000)).toBe('chr1:1,001-2,000')
  })

  it('handles a junction at the very start of a contig', () => {
    expect(formatSashimiLocation('chr1', 0, 100)).toBe('chr1:1-100')
  })
})
