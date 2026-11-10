import * as fillCurve from '../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyFillCurve.generated.ts'
import * as fillStraight from '../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyFillStraight.generated.ts'
import { sBlend } from '../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/syntenyTypes.js.generated.ts'
import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
} from '../../../plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyKinds.ts'
import { abgr, defineFixture, paintOver, rgba } from '../fixture.ts'

import type { Shape } from '../fixture.ts'

const W = 240
const H = 96
const DISPLAY_ALPHA = 0.5
const TOMATO = [255, 99, 71] as const
const BLUE = [40, 90, 200] as const
const GREEN = [30, 150, 70] as const
const WHITE = [255, 255, 255] as const

interface Ribbon {
  top: readonly [number, number]
  bottom: readonly [number, number]
  kind: number
  color: readonly [number, number, number]
}

const base: Ribbon = {
  top: [20, 150],
  bottom: [90, 220],
  kind: KIND_BASE,
  color: TOMATO,
}

const deletion = (left: number, widthPx: number, tip: number): Ribbon => ({
  top: [left, left + widthPx],
  bottom: [tip, tip],
  kind: KIND_CIGAR_D,
  color: BLUE,
})

const insertion = (tip: number, left: number, widthPx: number): Ribbon => ({
  top: [tip, tip],
  bottom: [left, left + widthPx],
  kind: KIND_CIGAR_I,
  color: GREEN,
})

const ribbons: Ribbon[] = [
  base,
  deletion(30, 1.5, 100),
  deletion(48, 4, 116),
  deletion(70, 8, 134),
  deletion(96, 16, 152),
  insertion(124, 180, 4),
  insertion(138, 196, 10),
]

function curveParamAtY(yFrac: number) {
  const half = (yFrac - 0.5) / 2
  const root = Math.sqrt(half * half + 1 / 64)
  return 0.5 + Math.cbrt(half + root) + Math.cbrt(half - root)
}

const overGround = (c: readonly [number, number, number], shade: number) =>
  [0, 1, 2].map(i => c[i]! * shade + WHITE[i]! * (1 - shade)) as [
    number,
    number,
    number,
  ]

function shapeOf(r: Ribbon, curve: boolean): Shape {
  return {
    color:
      r.kind === KIND_BASE
        ? rgba(r.color, DISPLAY_ALPHA)
        : rgba(overGround(r.color, DISPLAY_ALPHA)),
    inside: (x, y) => {
      const yFrac = y / H
      const s = curve ? sBlend(curveParamAtY(yFrac)) : yFrac
      const a = r.top[0] + (r.bottom[0] - r.top[0]) * s
      const b = r.top[1] + (r.bottom[1] - r.top[1]) * s
      return (
        yFrac >= 0 && yFrac < 1 && x >= Math.min(a, b) && x < Math.max(a, b)
      )
    },
  }
}

function fixture(
  name: string,
  about: string,
  slang: string,
  mod: typeof fillCurve | typeof fillStraight,
  curve: boolean,
) {
  return defineFixture({
    name,
    slang: `plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/${slang}`,
    about,
    mod,
    width: W,
    height: H,
    count: ribbons.length,
    instances: {
      bp1: ribbons.map(r => r.top[0]),
      bp2: ribbons.map(r => r.top[1]),
      bp3: ribbons.map(r => r.bottom[1]),
      bp4: ribbons.map(r => r.bottom[0]),
      color: ribbons.map(r => abgr(r.color)),
      featureId: ribbons.map(() => 1),
      kind: ribbons.map(r => r.kind),
    },
    uniforms: dpr => ({
      resolution: [W, H] as [number, number],
      height: H,
      panPx0: 0,
      bpPerPxInv0: 1,
      panPx1: 0,
      bpPerPxInv1: 1,
      overdrawPx: 100,
      alpha: DISPLAY_ALPHA,
      hoveredFeatureId: 0,
      clickedFeatureId: 0,
      yTop: 0,
      fadeThinAlignments: 0,
      devicePixelRatio: dpr,
      ground: [1, 1, 1] as [number, number, number],
      ink: [0, 0, 0] as [number, number, number],
    }),
    reference: paintOver(ribbons.map(r => shapeOf(r, curve))),
    budget: { max: 0.4, meanErr: 0.012 },
  })
}

export default [
  fixture(
    'synteny-indels-curve',
    'a sheared bezier ribbon with deletion and insertion wedges 1.5 to 16 px wide, each narrowing to a point',
    'syntenyFillCurve.slang',
    fillCurve,
    true,
  ),
  fixture(
    'synteny-indels-straight',
    'the same ribbon and wedges with straight edges',
    'syntenyFillStraight.slang',
    fillStraight,
    false,
  ),
]
