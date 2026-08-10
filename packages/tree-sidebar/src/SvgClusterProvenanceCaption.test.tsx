import { render } from '@testing-library/react'

import { SvgClusterProvenanceCaption } from './SvgClusterProvenanceCaption.tsx'

function renderCaption(
  props: Parameters<typeof SvgClusterProvenanceCaption>[0],
) {
  return render(
    <svg>
      <SvgClusterProvenanceCaption {...props} />
    </svg>,
  ).container
}

test('captions the locus the tree was computed from', () => {
  const text = renderCaption({
    clusterProvenance: { regions: [{ refName: 'ctgA', start: 0, end: 1000 }] },
  }).querySelector('text')

  expect(text?.textContent).toContain('ctgA')
  // The four literals both exports used to state separately. Pinned here rather
  // than left to the call sites, because agreeing was exactly what nothing was
  // enforcing — see the component's own note.
  expect(text?.getAttribute('fill')).toBe('#666')
  expect(text?.getAttribute('font-size')).toBe('11')
  expect(text?.getAttribute('x')).toBe('0')
  expect(text?.getAttribute('y')).toBe('-4')
})

// A tree that arrives as data (maf's supplied `.nh` phylogeny) has no locus, and
// `setClusterTree` clears the provenance for exactly that reason — captioning a
// phylogeny with a previous run's region is worse than no caption.
test('draws nothing for a tree that carries no provenance', () => {
  expect(
    renderCaption({ clusterProvenance: undefined }).querySelector('text'),
  ).toBeNull()
})
