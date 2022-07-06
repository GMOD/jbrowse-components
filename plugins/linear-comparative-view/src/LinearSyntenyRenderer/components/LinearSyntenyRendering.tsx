import React, { useState, useRef, useMemo, useEffect } from 'react'
import Color from 'color'
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
  getSession,
  viewBpToPx,
  ViewSnap,
  AssemblyManager,
  isSessionModelWithWidgets,
  getContainingTrack,
} from '@jbrowse/core/util'

// locals
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

const darkerColorMap = Object.fromEntries(
  Object.entries(colorMap).map(([key, val]) => [
    key,
    Color(val).darken(0.6).toString(),
  ]),
)

function getId(r: number, g: number, b: number) {
  return r * 255 * 255 + g * 255 + b - 1
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
        for (const [f1, f2] of generateMatches(features[i], features[j], f =>
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

function getResources(model: LinearComparativeDisplay) {
  const worker = !('type' in model)
  if (!worker && isAlive(model)) {
    const parentView = getContainingView(model) as LinearSyntenyViewModel
    const color = getConf(model, ['renderer', 'color'])
    const session = getSession(model)
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
  const drawRef = useRef<HTMLCanvasElement>(null)
  const clickMapRef = useRef<HTMLCanvasElement>(null)
  const [visibleId, setVisibleId] = useState<number>()
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
    if (
      !drawRef.current ||
      !clickMapRef.current ||
      !offsets ||
      !views ||
      !isAlive(displayModel)
    ) {
      return
    }
    const ctx1 = drawRef.current.getContext('2d')
    const ctx2 = clickMapRef.current.getContext('2d')
    if (!ctx1 || !ctx2) {
      return
    }
    ctx1.resetTransform()
    ctx1.scale(highResolutionScaling, highResolutionScaling)
    ctx1.clearRect(0, 0, width, height)
    ctx2.clearRect(0, 0, width, height)
    // ctx1.fillStyle = color
    // ctx1.strokeStyle = color
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
      const idx = j + 1

      const r = Math.floor(idx / (255 * 255)) % 255
      const g = Math.floor(idx / 255) % 255
      const b = idx % 255
      ctx2.fillStyle = `rgb(${r},${g},${b})`
      const currentlyMousedOver = visibleId === j
      const currPalette = currentlyMousedOver ? darkerColorMap : colorMap
      ctx1.fillStyle = currPalette.M
      ctx1.strokeStyle = currPalette.M

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
          ctx1.beginPath()
          ctx2.beginPath()
          ctx1.moveTo(x11, y1)
          ctx2.moveTo(x11, y1)
          if (drawCurves) {
            ctx1.bezierCurveTo(x11, mid, x21, mid, x21, y2)
            ctx2.bezierCurveTo(x11, mid, x21, mid, x21, y2)
          } else {
            ctx1.lineTo(x21, y2)
            ctx2.lineTo(x21, y2)
          }
          ctx1.stroke()
          ctx2.stroke()
        } else {
          let cx1 = x11
          let cx2 = x21

          // flip the direction of the CIGAR drawing in horizontally flipped
          // modes
          const rev1 = x11 < x12 ? 1 : -1
          const rev2 = x21 < x22 ? 1 : -1

          const cigar = parsedCIGARs.get(f1.id())
          if (cigar) {
            // continuingFlag helps speed up zoomed out by skipping draw
            // commands on very small CIGAR features
            let continuingFlag = false
            let px1 = 0
            let px2 = 0
            for (let j = 0; j < cigar.length; j += 2) {
              const len = +cigar[j]
              const op = cigar[j + 1] as keyof typeof currPalette

              if (!continuingFlag) {
                px1 = cx1
                px2 = cx2
              }

              const d1 = len / viewSnaps[0].bpPerPx
              const d2 = len / viewSnaps[1].bpPerPx
              if (op === 'M' || op === '=' || op === 'X') {
                cx1 += d1 * rev1
                cx2 += d2 * rev2
              } else if (op === 'D') {
                cx2 += d2 * rev2
              } else if (op === 'N') {
                cx2 += d2 * rev2
              } else if (op === 'I') {
                cx1 += d1 * rev1
              }

              // check that we are even drawing in view here, e.g. that all
              // points are not all less than 0 or greater than width
              if (
                !(
                  Math.max(px1, px2, cx1, cx2) < 0 ||
                  Math.min(px1, px2, cx1, cx2) > width
                )
              ) {
                // if it is a small feature and not the last element of the
                // CIGAR (which could skip rendering it entire if we did turn
                // it on), then turn on continuing flag
                if (
                  Math.abs(cx1 - px1) < 1 &&
                  Math.abs(cx2 - px2) < 1 &&
                  j < cigar.length - 2
                ) {
                  continuingFlag = true
                } else {
                  continuingFlag = false

                  // allow rendering the dominant color when using continuing
                  // flag if the last element of continuing was a large
                  // feature, else just use match
                  ctx1.fillStyle =
                    currPalette[(continuingFlag && d1 > 1) || d2 > 1 ? op : 'M']

                  ctx1.beginPath()
                  ctx2.beginPath()
                  ctx1.moveTo(px1, y1)
                  ctx2.moveTo(px1, y1)
                  ctx1.lineTo(cx1, y1)
                  ctx2.lineTo(cx1, y1)
                  if (drawCurves) {
                    ctx1.bezierCurveTo(cx1, mid, cx2, mid, cx2, y2)
                    ctx2.bezierCurveTo(cx1, mid, cx2, mid, cx2, y2)
                  } else {
                    ctx1.lineTo(cx2, y2)
                    ctx2.lineTo(cx2, y2)
                  }
                  ctx1.lineTo(px2, y2)
                  ctx2.lineTo(px2, y2)
                  if (drawCurves) {
                    ctx1.bezierCurveTo(px2, mid, px1, mid, px1, y1)
                    ctx2.bezierCurveTo(px2, mid, px1, mid, px1, y1)
                  } else {
                    ctx1.lineTo(px1, y1)
                    ctx2.lineTo(px1, y1)
                  }
                  ctx1.closePath()
                  ctx2.closePath()
                  ctx1.fill()
                  ctx2.fill()
                }
              }
            }
          } else {
            ctx1.beginPath()
            ctx2.beginPath()
            ctx1.moveTo(x11, y1)
            ctx2.moveTo(x11, y1)
            ctx1.lineTo(x12, y1)
            ctx2.lineTo(x12, y1)
            if (drawCurves) {
              ctx1.bezierCurveTo(x12, mid, x22, mid, x22, y2)
              ctx2.bezierCurveTo(x12, mid, x22, mid, x22, y2)
            } else {
              ctx1.lineTo(x22, y2)
              ctx2.lineTo(x22, y2)
            }
            ctx1.lineTo(x21, y2)
            ctx2.lineTo(x21, y2)
            if (drawCurves) {
              ctx1.bezierCurveTo(x21, mid, x11, mid, x11, y1)
              ctx2.bezierCurveTo(x21, mid, x11, mid, x11, y1)
            } else {
              ctx1.lineTo(x11, y1)
              ctx2.lineTo(x11, y1)
            }
            ctx1.closePath()
            ctx2.closePath()
            ctx1.fill()
            ctx2.fill()
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
    visibleId,
  ])

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={drawRef}
        onMouseMove={event => {
          const ref = clickMapRef.current
          if (!ref) {
            return
          }
          const rect = ref.getBoundingClientRect()
          const ctx = ref.getContext('2d')
          if (!ctx) {
            return
          }
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top

          var [r, g, b] = ctx.getImageData(x, y, 1, 1).data
          setVisibleId(getId(r, g, b))
        }}
        onMouseLeave={() => setVisibleId(undefined)}
        onClick={event => {
          const ref = clickMapRef.current
          if (!ref) {
            return
          }
          const rect = ref.getBoundingClientRect()
          const ctx = ref.getContext('2d')
          if (!ctx) {
            return
          }
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top

          var [r, g, b] = ctx.getImageData(x, y, 1, 1).data
          const match = matches[getId(r, g, b)]
          const session = getSession(displayModel)
          if (!match) {
            session.notify('unknown click')
            return
          }
          // @ts-ignore
          if (isSessionModelWithWidgets(session)) {
            const featureWidget = session.addWidget(
              'BaseFeatureWidget',
              'baseFeature',
              {
                view: getContainingView(displayModel),
                track: getContainingTrack(displayModel),
                featureData: {
                  start: 0,
                  end: 0,
                  refName: 0,
                  f0: match[0].feature,
                  f1: match[1].feature,
                },
              },
            )

            session.showWidget(featureWidget)
          }
        }}
        data-testid="synteny_canvas"
        style={{ width, height, position: 'absolute' }}
        width={width * highResolutionScaling}
        height={height * highResolutionScaling}
      />
      <canvas
        ref={clickMapRef}
        style={{
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          visibility: 'hidden',
          position: 'absolute',
        }}
        width={width}
        height={height}
      />
    </div>
  )
}

export default observer(LinearSyntenyRendering)
