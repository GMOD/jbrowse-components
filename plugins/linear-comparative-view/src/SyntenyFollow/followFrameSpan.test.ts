import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { followFrameSpan } from './followFrameSpan.ts'

import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// One 10kb block, query chr1:100,000-110,000 against target Pp01:1,100,000+,
// and that is all that is loaded — the shape of an anchor row sitting on one
// alignment with unaligned sequence either side of it.
const feat: FeatPos = {
  id: 'f0',
  name: 'f0',
  strand: 1,
  refName: 'chr1',
  start: 100_000,
  end: 110_000,
  assemblyName: 'grape',
  mate: {
    start: 1_100_000,
    end: 1_110_000,
    refName: 'Pp01',
    assemblyName: 'peach',
  },
  attributes: {},
}

const data = packSyntenyFeatureData([
  {
    id: feat.id,
    name: feat.name,
    refName: feat.refName,
    start: feat.start,
    end: feat.end,
    assembly: feat.assemblyName,
    mateRefName: feat.mate.refName,
    mateStart: feat.mate.start,
    mateEnd: feat.mate.end,
    mateAssembly: feat.mate.assemblyName,
  },
])

const win = (start: number, end: number): FollowWindow => ({
  refName: 'chr1',
  start,
  end,
})

const frame = (window: FollowWindow, transform?: undefined) =>
  followFrameSpan({ feat, data, window, toMate: true, transform })

test('a window inside the block interpolates across it', () => {
  expect(frame(win(102_000, 103_000))).toEqual({
    refName: 'Pp01',
    start: 1_102_000,
    end: 1_103_000,
  })
})

test('a window wider than the block maps through everything under it', () => {
  // the envelope, not the block clamped to itself
  expect(frame(win(50_000, 200_000))).toEqual({
    refName: 'Pp01',
    start: 1_100_000,
    end: 1_110_000,
  })
})

test('a window overlapping the block edge still resolves', () => {
  expect(frame(win(105_000, 200_000))).toMatchObject({ refName: 'Pp01' })
})

// The bug this file exists for. The exact pass raises `followUnaligned` and
// places nothing here; the per-frame pass used to interpolate anyway, and
// `interpolateFollowSpan` clamps the window to the block first — so both edges
// collapsed onto the block's far corner and the followed row was flung to a
// ONE-BASE span at maximum zoom, at the same moment the header said nothing
// aligns here.
test('a window clean off the block holds the row rather than zooming it to one base', () => {
  expect(frame(win(200_000, 210_000))).toBeUndefined()
  expect(frame(win(0, 10_000))).toBeUndefined()
})

test('a window on another contig holds the row', () => {
  expect(
    followFrameSpan({
      feat,
      data,
      window: { refName: 'chr9', start: 0, end: 1000 },
      toMate: true,
    }),
  ).toBeUndefined()
})

// The anchor navigating between contigs, which is the only way the frame pass
// gets a window whose refName its block knows nothing about — it reuses the
// block the last settle chose, and the settle is still 500ms away. On COORDINATES
// ALONE this window looks inside the block, and the row was flung through it to
// the mate of a stretch of chr1 while the anchor was showing chr9.
test('a window on another contig at coordinates inside the block still holds it', () => {
  const elsewhere = { refName: 'chr9', start: 102_000, end: 103_000 }
  expect(
    followFrameSpan({ feat, data, window: elsewhere, toMate: true }),
  ).toBeUndefined()
  // and the cached transform is no escape hatch: it refuses on the refName and
  // used to hand the question straight to the interpolator
  expect(
    followFrameSpan({
      feat,
      data,
      window: elsewhere,
      toMate: true,
      transform: {
        refName: 'chr1',
        a0: 100_000,
        a1: 110_000,
        targetRefName: 'Pp01',
        b0: 1_100_000,
        b1: 1_110_000,
      },
    }),
  ).toBeUndefined()
})

test('a cached transform answers for a window inside the block', () => {
  // measured over 100,000-110,000 -> 2,100,000-2,110,000 on a different contig
  // than the loaded block says, so the answer can only have come from it
  expect(
    followFrameSpan({
      feat,
      data,
      window: win(102_000, 103_000),
      toMate: true,
      transform: {
        refName: 'chr1',
        a0: 100_000,
        a1: 110_000,
        targetRefName: 'Pp02',
        b0: 2_100_000,
        b1: 2_110_000,
      },
    }),
  ).toEqual({ refName: 'Pp02', start: 2_102_000, end: 2_103_000 })
})

// Why the cached transform is only ever taken from a single-block resolve (see
// installSyntenyFollow): with no transform the frame pass interpolates the
// block, which reads the strand off the block itself and puts the window's left
// on the mate's RIGHT. A forward transform cached from an envelope resolve says
// the opposite, and there is no strand to give it — the envelope is a union
// several blocks contributed to.
test('an inverted block places the window on the opposite half of its mate', () => {
  const inverted = { ...feat, strand: -1 }
  expect(
    followFrameSpan({
      feat: inverted,
      data: { ...data, strands: Int8Array.from([-1]) },
      window: win(100_000, 102_000),
      toMate: true,
    }),
  ).toEqual({ refName: 'Pp01', start: 1_108_000, end: 1_110_000 })
})

test('a transform measured on another contig falls back to the block', () => {
  expect(
    followFrameSpan({
      feat,
      data,
      window: win(102_000, 103_000),
      toMate: true,
      transform: {
        refName: 'chr9',
        a0: 0,
        a1: 10_000,
        targetRefName: 'Pp02',
        b0: 0,
        b1: 10_000,
      },
    }),
  ).toEqual({ refName: 'Pp01', start: 1_102_000, end: 1_103_000 })
})
