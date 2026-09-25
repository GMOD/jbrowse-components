import { SimpleFeature } from '@jbrowse/core/util'

import { variantPaths } from './Variants.tsx'

import type { OverlayContext } from './overlayUtils.tsx'

const deletion = new SimpleFeature({
  uniqueId: 'del',
  refName: 'chr1',
  start: 99,
  end: 100,
  ALT: ['<DEL>'],
  INFO: { END: [500] },
})

function context(reversed = false) {
  return {
    session: {},
    match: {
      kind: 'variant',
      layoutMatches: [
        [
          {
            feature: deletion,
            level: 0,
            layout: [99, 10, 100, 20],
            clipLengthAtStartOfRead: 0,
          },
        ],
      ],
    },
    views: [{ bpToPx: ({ coord }: { coord: number }) => coord < 1000 }],
    tracks: [{ minimized: false }],
    layouts: [{ width: 1000 }],
    getX: (_level: number, _refName: string, coord: number) => ({
      x: coord,
      reversed,
    }),
    getY: () => 20,
    assemblies: [undefined],
  } as unknown as OverlayContext
}

test('a junction inside one row follows "Show intra-view links"', () => {
  expect(variantPaths(context(), true)).toHaveLength(1)
  expect(variantPaths(context(), false)).toHaveLength(0)
})

// A deletion's start keeps the sequence to its left, so its tick points left
// on a forward row and right on a reversed one.
test('a tick takes the orientation of the region its end is placed in', () => {
  const forward = variantPaths(context(false), true)[0]!.path
  const reversed = variantPaths(context(true), true)[0]!.path
  expect(forward.startsWith('M 79 20')).toBe(true)
  expect(reversed.startsWith('M 119 20')).toBe(true)
})
