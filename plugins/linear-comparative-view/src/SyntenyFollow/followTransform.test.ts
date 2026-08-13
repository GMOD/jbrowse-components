import { applyFollowTransform, followTransform } from './followTransform.ts'

import type { FollowWindow } from './followAnchorWindow.ts'

const win = (start: number, end: number, refName = 'chr1'): FollowWindow => ({
  refName,
  start,
  end,
})

const forward = followTransform(
  win(1000, 2000),
  { refName: 'chr1_pat', start: 5000, end: 6000 },
  false,
)!

test('the window it was measured over maps back to the span it resolved to', () => {
  expect(applyFollowTransform(forward, win(1000, 2000))).toEqual({
    refName: 'chr1_pat',
    start: 5000,
    end: 6000,
  })
})

test('panning the anchor moves the followed span by the same amount', () => {
  // 1:1 here, which is what makes a pan track rather than drift
  expect(applyFollowTransform(forward, win(1500, 2500))).toEqual({
    refName: 'chr1_pat',
    start: 5500,
    end: 6500,
  })
})

test('zooming the anchor scales the followed span about the same point', () => {
  expect(applyFollowTransform(forward, win(1250, 1750))).toEqual({
    refName: 'chr1_pat',
    start: 5250,
    end: 5750,
  })
})

test('an unequal correspondence carries its ratio', () => {
  const t = followTransform(
    win(1000, 2000),
    { refName: 'chr1_pat', start: 5000, end: 7000 },
    false,
  )!
  expect(applyFollowTransform(t, win(1500, 2000))).toEqual({
    refName: 'chr1_pat',
    start: 6000,
    end: 7000,
  })
})

describe('an inverted correspondence', () => {
  // the resolved span is always min..max, so the direction cannot be read back
  // off it — without the flag the followed row would pan the wrong way through
  // an inversion, which is the one case worth getting right here
  const inverted = followTransform(
    win(1000, 2000),
    { refName: 'chr1_pat', start: 5000, end: 6000 },
    true,
  )!

  test('still maps its own window onto its own span', () => {
    expect(applyFollowTransform(inverted, win(1000, 2000))).toEqual({
      refName: 'chr1_pat',
      start: 5000,
      end: 6000,
    })
  })

  test('moves the followed row the OTHER way as the anchor pans right', () => {
    expect(applyFollowTransform(inverted, win(1500, 2500))).toEqual({
      refName: 'chr1_pat',
      start: 4500,
      end: 5500,
    })
  })
})

test('a transform says nothing about another contig', () => {
  // the anchor has panned off the contig this was measured on; only a fresh
  // exact resolve can answer, and guessing would place the row on coordinates
  // from an unrelated sequence
  expect(applyFollowTransform(forward, win(1000, 2000, 'chr7'))).toBeUndefined()
})

test('a degenerate window or span builds no transform', () => {
  // dividing by its width is the first thing applying one does
  expect(
    followTransform(
      win(1000, 1000),
      { refName: 'x', start: 0, end: 10 },
      false,
    ),
  ).toBeUndefined()
  expect(
    followTransform(win(0, 10), { refName: 'x', start: 5, end: 5 }, false),
  ).toBeUndefined()
})
