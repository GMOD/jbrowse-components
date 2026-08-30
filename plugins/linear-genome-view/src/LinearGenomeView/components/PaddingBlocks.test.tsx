import { act, render } from '@testing-library/react'
import { observable } from 'mobx'

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

// The gate on the pooling. A zoom recomputes staticBlocks, so every span's
// `key` — its block identity — changes from one frame to the next while the
// span COUNT usually does not. Keyed by identity React rebuilt the whole list
// every frame; keyed by position it patches the nodes in place.
//
// Node identity is the assertion because it is what the DOM charges for: a
// remounted div pays styling, layout and paint where a patched one pays a style
// write. Measured over a 20-frame zoom in jbrowse-web's `ZoomRenderCensus`,
// this was ~360 structural mutations at eight tracks — the component mounts
// once per track plus once for the container, so the churn scaled with the
// session.
//
// The frame is driven by MUTATING an observable, not by RTL's `rerender`, and
// that is load-bearing: `rerender` remounts the tree from the root, so every
// node comes back fresh however the list is keyed and the assertion passes on
// nothing. What the app does is invalidate a mounted observer, which is this.
test('a zoom repositions the same divs rather than rebuilding them', () => {
  const model = observable(
    { ...makeModel(), paddingSpans: spans },
    {},
    { deep: false },
  ) as unknown as LinearGenomeViewModel & { paddingSpans: typeof spans }

  const { container } = render(<PaddingBlocks model={model} />)
  const before = spanDivs(container)

  // same spans, new block identities and shifted x: one zoom frame
  const zoomed = spans.map((s, i) => ({
    ...s,
    key: `frame2-${i}`,
    x: s.x * 1.15,
  }))
  act(() => {
    model.paddingSpans = zoomed
  })
  const after = spanDivs(container)

  expect(after).toHaveLength(before.length)
  for (const [i, node] of after.entries()) {
    expect(node).toBe(before[i])
  }
  expect(after.map(d => d.style.transform)).toEqual(
    zoomed.map(s => `translateX(${s.x}px)`),
  )
})
