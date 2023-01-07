import React, { useState, useRef, useMemo, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, isAlive } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import {
  assembleLocString,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  Feature,
} from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'

// locals
import { interstitialYPos } from '../../util'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import { LinearComparativeDisplay } from '../../LinearComparativeDisplay/stateModelFactory'
import SyntenyTooltip from './SyntenyTooltip'
import { draw, drawMatchSimple, layoutMatches } from './util'

const { parseCigar } = MismatchParser

const [LEFT, , RIGHT] = [0, 1, 2, 3]

const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

const colorMap = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

function getId(r: number, g: number, b: number, unitMultiplier: number) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
}

function getResources(model: LinearComparativeDisplay) {
  const inWorker = !('type' in model)
  if (!inWorker && isAlive(model)) {
    const parentView = getContainingView(model) as LinearSyntenyViewModel
    const color = getConf(model, ['renderer', 'color'])
    const session = getSession(model)
    const { assemblyManager } = session
    return { color, session, parentView, assemblyManager }
  }
  return {}
}

function LinearSyntenyRendering({
  displayModel,
  highResolutionScaling = 1,
}: {
  displayModel: LinearComparativeDisplay
  highResolutionScaling?: number
}) {
  const view = getContainingView(displayModel)
  const height = view.middleComparativeHeight
  const width = view.width

  // @ts-ignore
  const features = displayModel.features as Feature[]
  // canvas used for drawing visible screen
  const drawRef = useRef<HTMLCanvasElement>(null)

  // canvas used for drawing click map with feature ids
  // this renders a unique color per alignment, so that it can be re-traced
  // after a feature click with getImageData at that pixel
  const clickMapRef = useRef<HTMLCanvasElement>(null)

  // canvas used for drawing click map with cigar data
  // this can show if you are mousing over a insertion/deletion. it is similar
  // in purpose to the clickMapRef but was not feasible to pack this into the
  // clickMapRef
  const cigarClickMapRef = useRef<HTMLCanvasElement>(null)

  // canvas for drawing mouseover shading
  // this is separate from the other code for speed: don't have to redraw
  // entire canvas to do a feature's mouseover shading
  const mouseoverRef = useRef<HTMLCanvasElement>(null)

  const [mouseoverId, setMouseoverId] = useState<number>()
  const [clickId, setClickId] = useState<number>()
  const [visibleCigarOp, setVisibleCigarOp] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const { color, assemblyManager, parentView } = getResources(displayModel)

  const matches = useMemo(
    () => layoutMatches(features, assemblyManager),
    [features, assemblyManager],
  )

  const parsedCIGARs = useMemo(
    () =>
      new Map(
        features.map(f => [
          f.id(),
          parseCigar(f.get('CIGAR') as string | undefined),
        ]),
      ),
    [features],
  )
  const drawCurves = parentView?.drawCurves
  const drawCIGAR = parentView?.drawCIGAR
  const views = parentView?.views
  const offsets = views?.map(view => view.offsetPx)

  useEffect(
    () => {
      console.log('t1')
      if (
        !drawRef.current ||
        !clickMapRef.current ||
        !cigarClickMapRef.current ||
        !offsets ||
        !views ||
        !isAlive(displayModel)
      ) {
        return
      }
      const ctx1 = drawRef.current.getContext('2d')
      const ctx3 = cigarClickMapRef.current.getContext('2d')

      if (!ctx1 || !ctx3) {
        return
      }

      ctx3.imageSmoothingEnabled = false

      ctx1.resetTransform()
      ctx1.scale(highResolutionScaling, highResolutionScaling)
      ctx1.clearRect(0, 0, width, height)
      ctx1.beginPath()
      const showIntraviewLinks = false
      const hideTiny = false
      const viewSnaps = views.map(view => ({
        ...getSnapshot(view),
        width: view.width,
        staticBlocks: view.staticBlocks,
        interRegionPaddingWidth: view.interRegionPaddingWidth,
        minimumBlockWidth: view.minimumBlockWidth,
      }))
      const unitMultiplier = Math.floor(MAX_COLOR_RANGE / matches.length)

      // draw click map
      requestIdleCallback(() => {
        if (!clickMapRef.current) {
          return
        }
        const ctx2 = clickMapRef.current.getContext('2d')
        if (!ctx2) {
          return
        }
        ctx2.imageSmoothingEnabled = false
        ctx2.clearRect(0, 0, width, height)
        for (let j = 0; j < matches.length; j++) {
          const m = matches[j]
          const idx = j * unitMultiplier + 1
          ctx2.fillStyle = makeColor(idx)

          // too many click map false positives with colored stroked lines
          drawMatchSimple({
            cb: ctx => ctx.fill(),
            match: m,
            ctx: ctx2,
            drawCurves,
            offsets,
            hideTiny,
            height,
            viewSnaps,
            showIntraviewLinks,
          })
        }
      })

      // this loop is optimized to draw thousands/millions of thin lines as a polyline,
      // the polyline calls ctx.stroke once is much more efficient than calling stroke()
      // many times
      for (let j = 0; j < matches.length; j++) {
        const m = matches[j]
        ctx1.fillStyle = colorMap.M
        ctx1.strokeStyle = colorMap.M

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
          const length1 = f1.end - f1.start
          const length2 = f2.end - f2.start

          if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
            continue
          }

          const p11 = bpToPx({ self: v1, refName: ref1, coord: c1[LEFT] })
          const p12 = bpToPx({ self: v1, refName: ref1, coord: c1[RIGHT] })
          const p21 = bpToPx({ self: v2, refName: ref2, coord: c2[LEFT] })
          const p22 = bpToPx({ self: v2, refName: ref2, coord: c2[RIGHT] })
          if (
            p11 === undefined ||
            p12 === undefined ||
            p21 === undefined ||
            p22 === undefined
          ) {
            continue
          }

          const x11 = p11.offsetPx - offsets[l1]
          const x21 = p21.offsetPx - offsets[l2]

          const y1 = interstitialYPos(l1 < l2, height)
          const y2 = interstitialYPos(l2 < l1, height)

          const mid = (y2 - y1) / 2
          const minX = x21

          // drawing a line if the results are thin results in much less
          // pixellation than filling in a thin polygon
          if (
            (length1 < v1.bpPerPx || length2 < v2.bpPerPx) &&
            (minX < view.width || minX > 0)
          ) {
            ctx1.moveTo(x11, y1)

            if (drawCurves) {
              ctx1.bezierCurveTo(x11, mid, x21, mid, x21, y2)
            } else {
              ctx1.lineTo(x21, y2)
            }
          }
        }
      }
      ctx1.stroke()

      // this loop only draws small lines as a polyline, the polyline calls
      // ctx.stroke once is much more efficient than calling stroke() many times
      for (let j = 0; j < matches.length; j++) {
        const m = matches[j]
        ctx1.fillStyle = colorMap.M
        ctx1.strokeStyle = colorMap.M

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
          const length1 = f1.end - f1.start
          const length2 = f2.end - f2.start

          if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
            continue
          }

          const p11 = bpToPx({ self: v1, refName: ref1, coord: c1[LEFT] })
          const p12 = bpToPx({ self: v1, refName: ref1, coord: c1[RIGHT] })
          const p21 = bpToPx({ self: v2, refName: ref2, coord: c2[LEFT] })
          const p22 = bpToPx({ self: v2, refName: ref2, coord: c2[RIGHT] })
          if (
            p11 === undefined ||
            p12 === undefined ||
            p21 === undefined ||
            p22 === undefined
          ) {
            continue
          }

          const x11 = p11.offsetPx - offsets[l1]
          const x12 = p12.offsetPx - offsets[l1]
          const x21 = p21.offsetPx - offsets[l2]
          const x22 = p22.offsetPx - offsets[l2]
          const minX = Math.min(x21, x22)
          const maxX = Math.max(x21, x22)

          const y1 = interstitialYPos(l1 < l2, height)
          const y2 = interstitialYPos(l2 < l1, height)

          const mid = (y2 - y1) / 2

          if (
            !(length1 < v1.bpPerPx || length2 < v2.bpPerPx) &&
            (minX < view.width || maxX > 0)
          ) {
            const s1 = f1.strand
            const k1 = s1 === -1 ? x12 : x11
            const k2 = s1 === -1 ? x11 : x12

            // rev1/rev2 flip the direction of the CIGAR drawing in horizontally flipped
            // modes. somewhat heuristically determined, but tested for
            const rev1 = k1 < k2 ? 1 : -1
            const rev2 = (x21 < x22 ? 1 : -1) * s1

            // cx1/cx2 are the current x positions on top and bottom rows
            let cx1 = k1
            let cx2 = s1 === -1 ? x22 : x21

            const cigar = parsedCIGARs.get(f1.uniqueId)
            if (cigar?.length && drawCIGAR) {
              // continuingFlag skips drawing commands on very small CIGAR features
              let continuingFlag = false

              // px1/px2 are the previous x positions on the top and bottom rows
              let px1 = 0
              let px2 = 0
              const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
              for (let j = 0; j < cigar.length; j += 2) {
                const idx = j * unitMultiplier2 + 1
                ctx3.fillStyle = makeColor(idx)

                const len = +cigar[j]
                const op = cigar[j + 1] as keyof typeof colorMap

                if (!continuingFlag) {
                  px1 = cx1
                  px2 = cx2
                }

                const d1 = len / viewSnaps[0].bpPerPx
                const d2 = len / viewSnaps[1].bpPerPx

                if (op === 'M' || op === '=' || op === 'X') {
                  cx1 += d1 * rev1
                  cx2 += d2 * rev2
                } else if (op === 'D' || op === 'N') {
                  cx1 += d1 * rev1
                } else if (op === 'I') {
                  cx2 += d2 * rev2
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
                  const isNotLast = j < cigar.length - 2
                  if (
                    Math.abs(cx1 - px1) < 1 &&
                    Math.abs(cx2 - px2) < 1 &&
                    isNotLast
                  ) {
                    continuingFlag = true
                  } else {
                    continuingFlag = false

                    // allow rendering the dominant color when using continuing
                    // flag if the last element of continuing was a large
                    // feature, else just use match
                    ctx1.fillStyle =
                      colorMap[(continuingFlag && d1 > 1) || d2 > 1 ? op : 'M']

                    draw(ctx1, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                    draw(ctx3, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                  }
                }
              }
            } else {
              draw(ctx1, x11, x12, y1, x22, x21, y2, mid, drawCurves)
            }
          }
        }
      }
    },
    // eslint-disable-next-line  react-hooks/exhaustive-deps
    [
      displayModel,
      highResolutionScaling,
      width,
      drawCurves,
      drawCIGAR,
      color,
      height,
      matches,
      parsedCIGARs,
      // these are checked with a JSON.stringify to help compat with mobx
      // JSON.stringify(views), // eslint-disable-line  react-hooks/exhaustive-deps
      JSON.stringify(offsets), // eslint-disable-line  react-hooks/exhaustive-deps
    ],
  )

  // draw mouseover shading on the mouseover'd ID
  useEffect(
    () => {
      if (
        !mouseoverRef.current ||
        !offsets ||
        !views ||
        !isAlive(displayModel)
      ) {
        return
      }
      const ctx = mouseoverRef.current.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.resetTransform()
      ctx.scale(highResolutionScaling, highResolutionScaling)
      ctx.clearRect(0, 0, width, height)
      const showIntraviewLinks = false
      const hideTiny = false
      const viewSnaps = views.map(view => ({
        ...getSnapshot(view),
        staticBlocks: view.staticBlocks,
        width: view.width,
        interRegionPaddingWidth: view.interRegionPaddingWidth,
        minimumBlockWidth: view.minimumBlockWidth,
      }))

      if (mouseoverId !== undefined && matches[mouseoverId]) {
        const m = matches[mouseoverId]
        ctx.fillStyle = 'rgb(0,0,0,0.1)'
        drawMatchSimple({
          match: m,
          ctx,
          offsets,
          cb: ctx => ctx.fill(),
          showIntraviewLinks,
          height,
          hideTiny,
          viewSnaps,
          drawCurves,
        })
      }

      if (clickId !== undefined && matches[clickId]) {
        const m = matches[clickId]
        ctx.strokeStyle = 'rgb(0, 0, 0, 0.9)'
        drawMatchSimple({
          match: m,
          ctx,
          offsets,
          cb: ctx => ctx.stroke(),
          showIntraviewLinks,
          height,
          hideTiny,
          viewSnaps,
          drawCurves,
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      displayModel,
      highResolutionScaling,
      width,
      drawCurves,
      color,
      height,
      matches,
      parsedCIGARs,
      mouseoverId,
      clickId,
      // these are checked with a JSON.stringify to help compat with mobx
      JSON.stringify(views), // eslint-disable-line  react-hooks/exhaustive-deps
      JSON.stringify(offsets), // eslint-disable-line  react-hooks/exhaustive-deps
    ],
  )

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={mouseoverRef}
        width={width}
        height={height}
        style={{ width, height, position: 'absolute', pointerEvents: 'none' }}
      />
      <canvas
        ref={drawRef}
        onMouseMove={event => {
          const ref1 = clickMapRef.current
          const ref2 = cigarClickMapRef.current
          if (!ref1 || !ref2) {
            return
          }
          const rect = ref1.getBoundingClientRect()

          const ctx1 = ref1.getContext('2d')
          const ctx2 = ref2.getContext('2d')
          if (!ctx1 || !ctx2) {
            return
          }
          const { clientX, clientY } = event
          const x = clientX - rect.left
          const y = clientY - rect.top
          setCurrX(clientX)
          setCurrY(clientY)

          const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
          const [r2, g2, b2] = ctx2.getImageData(x, y, 1, 1).data
          const unitMultiplier = Math.floor(MAX_COLOR_RANGE / matches.length)
          const id = getId(r1, g1, b1, unitMultiplier)
          const match1 = matches[id]
          setMouseoverId(id < 0 ? undefined : id)
          if (!match1) {
            setVisibleCigarOp('')
            return
          }
          const cigar = parsedCIGARs.get(match1[0].feature.uniqueId) || []
          const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
          const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
          const f1 = match1[0].feature
          const f2 = match1[1].feature
          const l1 = f1.end - f1.start
          const l2 = f2.end - f2.start
          const identity = f1.identity
          const n1 = f1.name
          const n2 = f2.name
          const tooltip = [`Query len: ${l1}<br/>Target len: ${l2}`]
          if (identity) {
            tooltip.push(`Identity: ${identity}`)
          }
          if (identity) {
            tooltip.push(`Loc1: ${assembleLocString(f1)}`)
            tooltip.push(`Loc2: ${assembleLocString(f2)}`)
          }

          if (cigar[cigarIdx]) {
            tooltip.push(
              `CIGAR operator: ${cigar[cigarIdx]}${cigar[cigarIdx + 1]}`,
            )
          }
          if (n1 && n2) {
            tooltip.push(`Name 1: ${n1}`)
            tooltip.push(`Name 2: ${n2}`)
          }
          setVisibleCigarOp(tooltip.join('<br/>'))
        }}
        onMouseLeave={() => setMouseoverId(undefined)}
        onClick={event => {
          const ref1 = clickMapRef.current
          const ref2 = cigarClickMapRef.current
          if (!ref1 || !ref2) {
            return
          }
          const rect = ref1.getBoundingClientRect()

          const ctx1 = ref1.getContext('2d')
          const ctx2 = ref2.getContext('2d')
          if (!ctx1 || !ctx2) {
            return
          }
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top

          const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
          const unitMultiplier = Math.floor(MAX_COLOR_RANGE / matches.length)
          const id = getId(r1, g1, b1, unitMultiplier)
          const match1 = matches[id]
          const session = getSession(displayModel)
          setClickId(id < 0 ? undefined : id)
          if (match1 && isSessionModelWithWidgets(session)) {
            session.showWidget(
              session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
                featureData: {
                  feature1: match1[0].feature,
                  feature2: match1[1].feature,
                },
              }),
            )
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
      <canvas
        ref={cigarClickMapRef}
        style={{
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          visibility: 'hidden',
          position: 'absolute',
        }}
        width={width}
        height={height}
      />
      {mouseoverId !== undefined && currX && currY ? (
        <SyntenyTooltip x={currX} y={currY} title={visibleCigarOp} />
      ) : null}
    </div>
  )
}

export default observer(LinearSyntenyRendering)
