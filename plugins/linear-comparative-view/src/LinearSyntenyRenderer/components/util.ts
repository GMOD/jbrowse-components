import { AssemblyManager, Feature, ViewSnap } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'

// locals
import { generateMatches, interstitialYPos } from '../../util'

type RectTuple = [number, number, number, number]

interface Match {
  layout: RectTuple
  feature: Feature
  level: number
  refName: string
}

const [LEFT, , RIGHT] = [0, 1, 2, 3]

export function drawMatchSimple({
  match,
  ctx,
  offsets,
  cb,
  viewSnaps,
  showIntraviewLinks,
  hideTiny,
  height,
  drawCurves,
}: {
  match: Match[]
  ctx: CanvasRenderingContext2D
  offsets: number[]
  cb: (ctx: CanvasRenderingContext2D) => void
  viewSnaps: ViewSnap[]
  showIntraviewLinks: boolean
  hideTiny: boolean
  height: number
  drawCurves?: boolean
}) {
  // we follow a path in the list of chunks, not from top to bottom, just
  // in series following x1,y1 -> x2,y2
  for (let i = 0; i < match.length - 1; i += 1) {
    const { layout: c1, feature: f1, level: l1, refName: ref1 } = match[i]
    const { layout: c2, feature: f2, level: l2, refName: ref2 } = match[i + 1]
    const v1 = viewSnaps[l1]
    const v2 = viewSnaps[l2]

    if (!c1 || !c2) {
      console.warn('received null layout for a overlay feature')
      return
    }

    // disable rendering connections in a single level
    if (!showIntraviewLinks && l1 === l2) {
      continue
    }
    const length1 = f1.get('end') - f1.get('start')
    const length2 = f2.get('end') - f2.get('start')

    if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
      continue
    }

    const px11 = px(v1, { refName: ref1, coord: f1.get('start') })
    const px12 = px(v1, { refName: ref1, coord: f1.get('end') })
    const px21 = px(v2, { refName: ref2, coord: f2.get('start)') })
    const px22 = px(v2, { refName: ref2, coord: f2.get('end') })
    if (
      px11 === undefined ||
      px12 === undefined ||
      px21 === undefined ||
      px22 === undefined
    ) {
      continue
    }

    const x11 = px11 - offsets[l1]
    const x12 = px12 - offsets[l1]
    const x21 = px21 - offsets[l2]
    const x22 = px22 - offsets[l2]

    const y1 = interstitialYPos(l1 < l2, height)
    const y2 = interstitialYPos(l2 < l1, height)
    const mid = (y2 - y1) / 2

    // drawing a line if the results are thin: drawing a line results in much
    // less pixellation than filling in a thin polygon
    if (length1 < v1.bpPerPx || length2 < v2.bpPerPx) {
      ctx.beginPath()
      ctx.moveTo(x11, y1)
      if (drawCurves) {
        ctx.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx.lineTo(x21, y2)
      }
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(x11, y1)
      ctx.lineTo(x12, y1)
      if (drawCurves) {
        ctx.bezierCurveTo(x12, mid, x22, mid, x22, y2)
      } else {
        ctx.lineTo(x22, y2)
      }
      ctx.lineTo(x21, y2)
      if (drawCurves) {
        ctx.bezierCurveTo(x21, mid, x11, mid, x11, y1)
      } else {
        ctx.lineTo(x11, y1)
      }
      ctx.closePath()
      cb(ctx)
    }
  }
}

export function px(view: ViewSnap, arg: { refName: string; coord: number }) {
  return bpToPx({ ...arg, self: view })?.offsetPx
}

export function layoutMatches(
  feats: Feature[][],
  assemblyManager?: AssemblyManager,
) {
  const matches = []
  for (let i = 0; i < feats.length; i++) {
    for (let j = i; j < feats.length; j++) {
      if (i !== j) {
        for (const [f1, f2] of generateMatches(feats[i], feats[j], f =>
          f.get('syntenyId'),
        )) {
          let f1s = f1.get('start')
          let f1e = f1.get('end')
          const f2s = f2.get('start')
          const f2e = f2.get('end')

          if (f1.get('strand') === -1) {
            ;[f1e, f1s] = [f1s, f1e]
          }
          const a1 = assemblyManager?.get(f1.get('assemblyName'))
          const a2 = assemblyManager?.get(f2.get('assemblyName'))
          const r1 = f1.get('refName')
          const r2 = f2.get('refName')

          matches.push([
            {
              feature: f1,
              level: i,
              refName: a1?.getCanonicalRefName(r1) || r1,
              layout: [f1s, 0, f1e, 10] as RectTuple,
            },
            {
              feature: f2,
              level: j,
              refName: a2?.getCanonicalRefName(r2) || r2,
              layout: [f2s, 0, f2e, 10] as RectTuple,
            },
          ])
        }
      }
    }
  }
  return matches
}
