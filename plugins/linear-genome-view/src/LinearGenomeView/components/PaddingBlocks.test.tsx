import { render } from '@testing-library/react'

import PaddingBlocks from './PaddingBlocks.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// PaddingBlocks draws every span along the row that is not track data, and the
// geometry now comes from `model.paddingSpans` so a host writing its own chrome
// reads the same numbers (see the getter's comment, and the byo site's
// RegionBoundaries). What is left here is the mapping from a span's `kind` to
// what it looks like — three near-identical absolutely-positioned divs whose
// only difference is a background, which is precisely the kind of table that
// can be silently transposed.

const spans = [
  { key: 'before', x: -800, width: 800, kind: 'boundary' as const },
  { key: 'a-sep', x: 399, width: 3, kind: 'seam' as const },
  { key: 'tiny', x: 402, width: 2, kind: 'elided' as const },
  { key: 'b-sep', x: 800, width: 3, kind: 'seam' as const },
  { key: 'after', x: 803, width: 800, kind: 'boundary' as const },
]

// only the four members PaddingBlocks and ZoomTransform actually read
function makeModel() {
  return {
    paddingSpans: spans,
    offsetPx: 100,
    staticBlocks: { offsetPx: 0, totalWidthPx: 1603 },
  } as unknown as LinearGenomeViewModel
}

// walk down the two ZoomTransform wrappers and the absolute-fill layer, rather
// than matching a `div > div > div` chain that also selects those wrappers
function spanDivs(container: HTMLElement) {
  const fill = container.firstElementChild?.firstElementChild?.firstElementChild
  return [...(fill?.children ?? [])] as HTMLElement[]
}

test('one div per span, with the span geometry verbatim', () => {
  const { container } = render(<PaddingBlocks model={makeModel()} />)
  const divs = spanDivs(container)

  expect(divs).toHaveLength(spans.length)
  expect(divs.map(d => [d.style.transform, d.style.width])).toEqual(
    spans.map(s => [`translateX(${s.x}px)`, `${s.width}px`]),
  )
})

test('each kind gets its own look, and the same kind the same one', () => {
  const { container } = render(<PaddingBlocks model={makeModel()} />)
  const classes = spanDivs(container).map(d => d.getAttribute('class'))
  const [before, seamA, elided, seamB, after] = classes

  // the two seams agree, and no kind has been transposed onto another's style
  expect(seamA).toBe(seamB)
  expect(before).toBe(after)
  expect(new Set([seamA, elided, before]).size).toBe(3)
})
