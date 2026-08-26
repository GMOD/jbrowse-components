import { ARC_FOOT_PX, arcMarkScreenPath } from './arcPath.ts'
import { arcMarkFrom } from './mark.ts'
import { ARC_SHAPE_ARC } from './shapes.ts'

// What `feetSubpaths` puts in the arc's `d`: a tick of `ARC_FOOT_PX` leaving
// each anchor in that foot's direction, and nothing at all when the mark carries
// no feet. Pinned at unit level because every other statement of the feet is
// about their SIGN — `arcBreakendFeet.test.ts` reads directions off the path and
// says nothing about how far they reach.
//
// A foot is deliberately NOT bounded by the arc it hangs off, so two feet closer
// together than a foot is long merge into one bar; `ARC_FOOT_PX` carries the
// worked case. What is unfinished is bounding one by its own DISPLAYED REGION —
// agent-docs/ideas/bound-a-breakend-foot-by-its-displayed-region.md.
const FRAME = {
  arcsTop: 0,
  arcsH: 100,
  pairedArcsDown: false,
  screenWidthPx: 1000,
  arcsYDomainBp: 1000,
  arcsYLog: false,
}

// Signed foot lengths keyed by the anchor they leave, read off the path the same
// way the renderer does — `M x y L x2 y` after the arc command.
function feetOf(d: string) {
  return [...d.matchAll(/M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) \2/g)].map(m => ({
    from: Number(m[1]!),
    len: Number(m[3]!) - Number(m[1]!),
  }))
}

function pathFor(sx1: number, sx2: number, dir1: number, dir2: number) {
  return arcMarkScreenPath(
    arcMarkFrom(
      {
        sx1,
        sx2,
        yBp: 500,
        shapeType: ARC_SHAPE_ARC,
        feet: { dir1, dir2, insetPx: 0.5 },
      },
      FRAME,
    ),
  )
}

test('each foot leaves its own anchor, one foot length, in its own direction', () => {
  // Outward, which after `pairOuterDir` is what an ordinary FR pair and a
  // deletion-type split junction both draw.
  expect(feetOf(pathFor(100, 300, -1, 1))).toEqual([
    { from: 100, len: -ARC_FOOT_PX },
    { from: 300, len: ARC_FOOT_PX },
  ])
  expect(feetOf(pathFor(100, 300, 1, -1))).toEqual([
    { from: 100, len: ARC_FOOT_PX },
    { from: 300, len: -ARC_FOOT_PX },
  ])
})

test('and keeps its length where the two would merge into one bar', () => {
  // 12 px apart, feet 20: they overlap, and that is the mark working rather than
  // failing — they overlap precisely because both ends keep the same stretch, so
  // the bar is that stretch drawn (`ARC_FOOT_PX`). Pinned so a bound added for
  // the region case cannot quietly become a bound on the arc.
  expect(feetOf(pathFor(100, 112, 1, 1))).toEqual([
    { from: 100, len: ARC_FOOT_PX },
    { from: 112, len: ARC_FOOT_PX },
  ])
})

test('an arc with no feet traces only its curve', () => {
  // The per-region passes' arcs, which `arcMark` builds with no `feet` at all —
  // so this is what every arc outside the cross-region overlay draws.
  const d = arcMarkScreenPath(
    arcMarkFrom(
      { sx1: 100, sx2: 300, yBp: 500, shapeType: ARC_SHAPE_ARC },
      FRAME,
    ),
  )
  expect(feetOf(d)).toEqual([])
  expect(d).toContain('A ')
})
