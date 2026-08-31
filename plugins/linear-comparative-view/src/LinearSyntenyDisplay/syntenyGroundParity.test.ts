import { createCanvas } from 'canvas'

import { KIND_BASE, KIND_CIGAR_D } from '../LinearSyntenyRPC/syntenyColors.ts'
import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'
import { offscreenMateColors } from './drawOffscreenMates.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// The property the band's ground exists to hold, on a real rasterizer.
//
// `shadeFill`'s two branches are different arithmetic: a BASE ribbon composites
// at alpha `shade`, while a CIGAR indel bakes the same blend against the ground
// and writes OPAQUE so it covers the base block underneath without fading twice.
// They land on the same pixel only when the destination really is that ground —
// which is why the clear is not a background but a term in the fill.
//
// Pinned over TWO grounds rather than one. Over white the arithmetic agrees for
// the wrong reason as well as the right one: `255 * (1 - shade)` was a literal,
// and a literal is indistinguishable from a threaded value until the ground
// moves. A dark band is the case that tells them apart.
const W = 200
const H = 60
const ALPHA = 0.3
const BLUE = 0xffff0000

function ribbon(kind: number): SyntenyInstanceData {
  return {
    bp1: Float32Array.from([20]),
    bp2: Float32Array.from([180]),
    bp3: Float32Array.from([20]),
    bp4: Float32Array.from([180]),
    base0: 0,
    base1: 0,
    colors: Uint32Array.from([BLUE]),
    kinds: Uint8Array.from([kind]),
    instanceFeatureIdx: Uint32Array.from([0]),
    alignmentLengths: Float32Array.from([10000]),
    instanceCount: 1,
  }
}

function centerPixel(kind: number, groundColor: string) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = groundColor
  ctx.fillRect(0, 0, W, H)
  drawSyntenyTrack(
    ctx,
    ribbon(kind),
    {
      yTop: 0,
      height: H,
      alpha: ALPHA,
      fadeThinAlignments: false,
      minAlignmentLength: 0,
      hoveredFeatureId: 0,
      clickedFeatureId: 0,
      offsetPx0: 0,
      offsetPx1: 0,
      bpPerPx0: 1,
      bpPerPx1: 1,
      drawCurves: false,
    },
    W,
    300,
    groundColor,
  )
  const [r, g, b] = ctx.getImageData(W / 2, H / 2, 1, 1).data
  return [r!, g!, b!] as [number, number, number]
}

describe.each(['#fff', '#121212'])('over a %s band', ground => {
  test('an indel wedge lands where the base ribbon beside it does', () => {
    const base = centerPixel(KIND_BASE, ground)
    const indel = centerPixel(KIND_CIGAR_D, ground)
    base.forEach((c, i) => {
      expect(Math.abs(c - indel[i]!)).toBeLessThanOrEqual(1)
    })
  })
})

// The failure the parity test above catches, stated directly: a hard-coded white
// in the pre-blend leaves an indel wedge at (178,178,255) on a #121212 band — a
// bright hole punched through the ribbons rather than a tint of them.
test('a wedge on a dark band stays dark', () => {
  const [r, g] = centerPixel(KIND_CIGAR_D, '#121212')
  expect(Math.max(r, g)).toBeLessThan(40)
})

// The marks and their label halo are the same two colours the band is made of,
// so a band that moves takes them with it. Read off `getContrastText`, which is
// what keeps a light-mode grey from being asked to show up on #121212.
test('the off-screen-mate strip follows the ground it is drawn on', () => {
  const light = offscreenMateColors('#fff')
  const dark = offscreenMateColors('#121212')
  // the exact strings the light theme drew before the ground was threaded
  expect(light.markColor).toBe('rgba(0, 0, 0, 0.35)')
  expect(light.labelColor).toBe('rgba(0, 0, 0, 0.6)')
  expect(light.haloColor).toBe('#fff')
  expect(dark.markColor).toBe('rgba(255, 255, 255, 0.35)')
  expect(dark.haloColor).toBe('#121212')
})
