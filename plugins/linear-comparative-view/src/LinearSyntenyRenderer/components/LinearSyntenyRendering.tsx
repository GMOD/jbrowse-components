import React, { useRef, useMemo, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, isAlive } from 'mobx-state-tree'
import SimpleFeature, {
  SimpleFeatureSerialized,
  Feature,
} from '@jbrowse/core/util/simpleFeature'
import { getConf } from '@jbrowse/core/configuration'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import {
  getContainingView,
  viewBpToPx,
  getSession,
  ViewSnap,
  AssemblyManager,
} from '@jbrowse/core/util'
import { interstitialYPos, overlayYPos, generateMatches } from '../../util'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import { LinearComparativeDisplay } from '../../LinearComparativeDisplay'

const [LEFT, , RIGHT] = [0, 1, 2, 3]

type RectTuple = [number, number, number, number]

const colorMap = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

function px(view: ViewSnap, arg: { refName: string; coord: number }) {
  return viewBpToPx({ ...arg, self: view })?.offsetPx || 0
}

function layoutMatches(
  features: Feature[][],
  assemblyManager?: AssemblyManager,
) {
  const matches = []
  for (let i = 0; i < features.length; i++) {
    for (let j = i; j < features.length; j++) {
      if (i !== j) {
        for (const [f1, f2] of generateMatches(features[i], features[j], feat =>
          feat.get('syntenyId'),
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
              refName: a1?.getCanonicalRefName(f1.get('refName')) || r1,
              layout: [f1s, 0, f1e, 10] as RectTuple,
            },
            {
              feature: f2,
              level: j,
              refName: a2?.getCanonicalRefName(f1.get('refName')) || r2,
              layout: [f2s, 0, f2e, 10] as RectTuple,
            },
          ])
        }
      }
    }
  }
  return matches
}

/**
 * A block whose content is rendered outside of the main thread and hydrated by
 * this component.
 */

function getResources(displayModel: LinearComparativeDisplay) {
  const worker = !('type' in displayModel)
  if (!worker && isAlive(displayModel)) {
    const parentView = getContainingView(displayModel) as LinearSyntenyViewModel
    const color = getConf(displayModel, ['renderer', 'color'])
    const session = getSession(displayModel)
    const { assemblyManager } = session
    return { color, session, parentView, assemblyManager }
  }
  return {}
}
function LinearSyntenyRendering({
  height,
  width,
  displayModel,
  features,
  trackIds,
  highResolutionScaling = 1,
}: {
  width: number
  height: number
  displayModel: LinearComparativeDisplay
  highResolutionScaling: number
  features: SimpleFeatureSerialized[][]
  trackIds: string[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { color, assemblyManager, parentView } = getResources(displayModel)
  const hydratedFeatures = useMemo(
    () =>
      features.map(level =>
        level
          .map(f => new SimpleFeature(f))
          .sort((a, b) => a.get('syntenyId') - b.get('syntenyId')),
      ),
    [features],
  )
  const matches = useMemo(
    () => layoutMatches(hydratedFeatures, assemblyManager),
    [hydratedFeatures, assemblyManager],
  )

  const parsedCIGARs = useMemo(
    () =>
      new Map(
        hydratedFeatures.flat().map(f => {
          const cigar = f.get('cg') || f.get('CIGAR')
          return [f.id(), cigar ? MismatchParser.parseCigar(cigar) : undefined]
        }),
      ),
    [hydratedFeatures],
  )
  const drawCurves = parentView?.drawCurves
  const views = parentView?.views
  const offsets = views?.map(view => view.offsetPx)

  useEffect(() => {
    if (!ref.current || !offsets || !views || !isAlive(displayModel)) {
      return
    }
    const ctx = ref.current.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.resetTransform()
    ctx.scale(highResolutionScaling, highResolutionScaling)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = color
    ctx.strokeStyle = color
    const showIntraviewLinks = false
    const middle = true
    const hideTiny = false
    const viewSnaps = views.map(view => ({
      ...getSnapshot(view),
      width: view.width,
      interRegionPaddingWidth: view.interRegionPaddingWidth,
      minimumBlockWidth: view.minimumBlockWidth,
    }))

    for (let j = 0; j < matches.length; j++) {
      const m = matches[j]
      // we follow a path in the list of chunks, not from top to bottom, just
      // in series following x1,y1 -> x2,y2
      for (let i = 0; i < m.length - 1; i += 1) {
        const { layout: c1, feature: f1, level: l1, refName: ref1 } = m[i]
        const { layout: c2, feature: f2, level: l2, refName: ref2 } = m[i + 1]
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

        const x11 = px(v1, { refName: ref1, coord: c1[LEFT] }) - offsets[l1]
        const x12 = px(v1, { refName: ref1, coord: c1[RIGHT] }) - offsets[l1]
        const x21 = px(v2, { refName: ref2, coord: c2[LEFT] }) - offsets[l2]
        const x22 = px(v2, { refName: ref2, coord: c2[RIGHT] }) - offsets[l2]

        const y1 = middle
          ? interstitialYPos(l1 < l2, height)
          : // prettier-ignore
            // @ts-ignore
            overlayYPos(trackIds[0], l1, viewSnaps, c1, l1 < l2)
        const y2 = middle
          ? interstitialYPos(l2 < l1, height)
          : // prettier-ignore
            // @ts-ignore
            overlayYPos(trackIds[1], l2, viewSnaps, c2, l2 < l1)

        const mid = (y2 - y1) / 2

        // drawing a line if the results are thin results in much less
        // pixellation than filling in a thin polygon
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
          let cx1 = x11
          let cx2 = x21

          // flip the direction of the CIGAR drawing in horizontally flipped
          // modes
          const rev1 = x11 < x12 ? 1 : -1
          const rev2 = x21 < x22 ? 1 : -1

          const cigar = parsedCIGARs.get(f1.id())
          if (cigar) {
            for (let j = 0; j < cigar.length; j += 2) {
              const len = +cigar[j]
              const op = cigar[j + 1]

              const px1 = cx1
              const px2 = cx2

              if (op === 'M' || op === '=' || op === 'X') {
                cx1 += (len / viewSnaps[0].bpPerPx) * rev1
                cx2 += (len / viewSnaps[1].bpPerPx) * rev2
              } else if (op === 'D') {
                cx1 += (len / viewSnaps[0].bpPerPx) * rev1
              } else if (op === 'N') {
                cx1 += (len / viewSnaps[0].bpPerPx) * rev1
              } else if (op === 'I') {
                cx2 += (len / viewSnaps[1].bpPerPx) * rev2
              }

              // check that we are even drawing in view here
              if (
                !(
                  (px1 < 0 && px2 < 0 && cx1 < 0 && cx2 < 0) ||
                  (px1 > width && px2 > width && cx1 > width && cx2 > width)
                )
              ) {
                ctx.fillStyle = colorMap[op as keyof typeof colorMap]
                ctx.beginPath()
                ctx.moveTo(px1, y1)
                ctx.lineTo(cx1, y1)
                if (drawCurves) {
                  ctx.bezierCurveTo(cx1, mid, cx2, mid, cx2, y2)
                } else {
                  ctx.lineTo(cx2, y2)
                }
                ctx.lineTo(px2, y2)
                if (drawCurves) {
                  ctx.bezierCurveTo(px2, mid, px1, mid, px1, y1)
                } else {
                  ctx.lineTo(px1, y1)
                }
                ctx.closePath()
                ctx.fill()
              }
            }
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
            ctx.fill()
          }
        }
      }
    }
  }, [
    displayModel,
    highResolutionScaling,
    trackIds,
    width,
    views,
    offsets,
    drawCurves,
    color,
    height,
    matches,
    parsedCIGARs,
  ])

  return (
    <canvas
      ref={ref}
      data-testid="synteny_canvas"
      style={{ width, height }}
      width={width * highResolutionScaling}
      height={height * highResolutionScaling}
    />
  )
}

export default observer(LinearSyntenyRendering)
