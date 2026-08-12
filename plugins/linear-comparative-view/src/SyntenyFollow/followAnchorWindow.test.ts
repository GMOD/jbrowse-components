import { followAnchorWindow } from './followAnchorWindow.ts'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

function block({
  refName,
  start,
  end,
  widthPx,
}: {
  refName: string
  start: number
  end: number
  widthPx: number
}): ContentBlock {
  return {
    type: 'ContentBlock',
    key: `${refName}:${start}-${end}`,
    offsetPx: 0,
    widthPx,
    assemblyName: 'hg002mat',
    refName,
    start,
    end,
  }
}

test('a panel showing one contig yields that contig and its visible span', () => {
  expect(
    followAnchorWindow([
      block({ refName: 'chr1', start: 100, end: 200, widthPx: 800 }),
    ]),
  ).toEqual({
    refName: 'chr1',
    assemblyName: 'hg002mat',
    start: 100,
    end: 200,
  })
})

test('an empty panel has no window', () => {
  expect(followAnchorWindow([])).toBeUndefined()
})

test('blocks of one contig union into a single span', () => {
  // a contig split by an inter-region padding block still reads as one stretch
  expect(
    followAnchorWindow([
      block({ refName: 'chr1', start: 100, end: 200, widthPx: 400 }),
      block({ refName: 'chr1', start: 300, end: 500, widthPx: 400 }),
    ]),
  ).toMatchObject({ refName: 'chr1', start: 100, end: 500 })
})

test('the contig occupying the most screen wins, not the most bp', () => {
  // the huge contig is off in a corner of the viewport; the eye reads the view
  // as being on the small one, and so does the follow
  expect(
    followAnchorWindow([
      block({ refName: 'chrBig', start: 0, end: 10_000_000, widthPx: 50 }),
      block({ refName: 'chrSmall', start: 0, end: 1000, widthPx: 750 }),
    ]),
  ).toMatchObject({ refName: 'chrSmall' })
})

test('summed width decides, not the widest single block', () => {
  expect(
    followAnchorWindow([
      block({ refName: 'chrA', start: 0, end: 100, widthPx: 300 }),
      block({ refName: 'chrA', start: 200, end: 300, widthPx: 300 }),
      block({ refName: 'chrB', start: 0, end: 100, widthPx: 400 }),
    ]),
  ).toMatchObject({ refName: 'chrA', start: 0, end: 300 })
})
