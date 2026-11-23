import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_CIGAR_D,
} from '../../LinearSyntenyRPC/syntenyKinds.ts'
import { viewportWindow } from '../../LinearSyntenyRPC/testUtils.ts'
import { hoverLevel } from '../shaders/syntenyTypes.js.generated.ts'
import { getHoveredStretch } from './util.ts'

import type { SyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenyPickWithin } from '../syntenyRenderingBackendTypes.ts'

const packed = (len: number, op: number) => (len << 4) | op

// M100 M100 D50 M100 I30 M100: the first two matches meet edge to edge, then a
// deletion and an insertion split the rest into two more stretches.
const cigar = [
  packed(100, CIGAR_M),
  packed(100, CIGAR_M),
  packed(50, CIGAR_D),
  packed(100, CIGAR_M),
  packed(30, CIGAR_I),
  packed(100, CIGAR_M),
]

function build(cigarMode: 'matches' | 'full', strand = 1) {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([450]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([430]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([strand]),
    parsedCigars: [cigar],
    cigarMode,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1000,
    window0: viewportWindow({ viewOff: 0, viewWidth: 1000, bpPerPx: 1 }),
    window1: viewportWindow({ viewOff: 0, viewWidth: 1000, bpPerPx: 1 }),
  })
}

function levels(g: SyntenyGeometry, i: number, within: SyntenyPickWithin) {
  const stretch = getHoveredStretch(g, i, within)
  const [lo1, hi1, lo2, hi2] = stretch ?? [0, 0, 0, 0]
  return [...g.kinds.keys()]
    .filter(k => g.kinds[k] !== undefined)
    .map(k =>
      hoverLevel(
        g.instanceFeatureIdx[k]! + 1,
        g.instanceFeatureIdx[i]! + 1,
        stretch ? 1 : 0,
        g.bp1[k]!,
        g.bp2[k]!,
        g.bp3[k]!,
        g.bp4[k]!,
        lo1,
        hi1,
        lo2,
        hi2,
      ),
    )
}

function tiles(g: SyntenyGeometry) {
  return [...g.kinds.keys()].filter(k => g.kinds[k] === KIND_BASE_TILE)
}

test.each([1, -1])(
  'a tile darkens its own stretch and brightens the rest of the feature (strand %i)',
  strand => {
    const g = build('matches', strand)
    const t = tiles(g)
    expect(t).toHaveLength(4)
    const byTile = t.map(i => t.map(k => levels(g, i, 'instance')[k]))
    expect(byTile).toEqual([
      [2, 2, 1, 1],
      [2, 2, 1, 1],
      [1, 1, 2, 1],
      [1, 1, 1, 2],
    ])
  },
)

test.each<SyntenyPickWithin>(['gap', 'run'])(
  'a %s hit brightens the feature and darkens no part of it',
  within => {
    const g = build('matches')
    const t = tiles(g)
    const lit = levels(g, t[1]!, within)
    expect(t.map(k => lit[k])).toEqual([1, 1, 1, 1])
  },
)

test('a colored indel wedge darkens alone over the brightened block', () => {
  const g = build('full')
  const kinds = [...g.kinds]
  const wedge = kinds.indexOf(KIND_CIGAR_D)
  const block = kinds.indexOf(KIND_BASE)
  const lit = levels(g, wedge, 'instance')
  expect(lit[wedge]).toBe(2)
  expect(lit[block]).toBe(1)
})

test('the colored mode block darkens the whole feature, as before', () => {
  const g = build('full')
  const block = [...g.kinds].indexOf(KIND_BASE)
  expect(getHoveredStretch(g, block, 'instance')).toBeUndefined()
  expect(levels(g, block, 'instance').every(l => l === 2)).toBe(true)
})
