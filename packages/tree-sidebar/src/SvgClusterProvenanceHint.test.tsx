import { render } from '@testing-library/react'

import { SvgClusterProvenanceHint } from './SvgClusterProvenanceHint.tsx'

const clusterProvenance = {
  regions: [{ refName: 'ctgA', start: 0, end: 1000 }],
}

function renderHint(props: Parameters<typeof SvgClusterProvenanceHint>[0]) {
  return render(
    <svg>
      <SvgClusterProvenanceHint {...props} />
    </svg>,
  ).container.querySelector('text')
}

// A tree computed on the figure's own locus is the case a reader already
// assumes, and the screen draws nothing for it either.
test('draws nothing while the view is still on the clustered span', () => {
  expect(
    renderHint({
      clusterProvenance,
      contentBlocks: [{ refName: 'ctgA', start: 0, end: 1200 }],
    }),
  ).toBeNull()
})

test('warns with the clustered locus once the view has left it', () => {
  const text = renderHint({
    clusterProvenance,
    contentBlocks: [{ refName: 'ctgB', start: 0, end: 1000 }],
  })
  expect(text?.textContent).toBe('⚠ ctgA:1..1,000')
  // inside the rows box, where the per-track clip keeps it
  expect(Number(text?.getAttribute('y'))).toBeGreaterThan(0)
  expect(text?.getAttribute('paint-order')).toBe('stroke')
})

// A tree that arrives as data (maf's supplied `.nh` phylogeny) has no locus to
// have drifted from.
test('draws nothing for a tree that carries no provenance', () => {
  expect(
    renderHint({
      clusterProvenance: undefined,
      contentBlocks: [{ refName: 'ctgB', start: 0, end: 1000 }],
    }),
  ).toBeNull()
})
