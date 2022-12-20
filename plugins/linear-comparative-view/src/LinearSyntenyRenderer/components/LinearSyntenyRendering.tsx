import React, { useState, useRef, useMemo, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, isAlive } from 'mobx-state-tree'
import SimpleFeature, {
  SimpleFeatureSerialized,
  Feature,
} from '@jbrowse/core/util/simpleFeature'
import { getConf } from '@jbrowse/core/configuration'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import {
  assembleLocString,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

// locals
import { interstitialYPos } from '../../util'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import { LinearComparativeDisplay } from '../../LinearComparativeDisplay/stateModelFactory'
import SyntenyTooltip from './SyntenyTooltip'
import { drawMatchSimple, layoutMatches, px } from './util'

const { parseCigar } = MismatchParser

const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

const colorMap = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
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
  const es = useMemo(
    () =>
      features.map(level =>
        level
          .map(
            f =>
              (typeof f.id === 'function'
                ? f
                : new SimpleFeature(f)) as Feature,
          )
          .sort((a, b) => a.get('syntenyId') - b.get('syntenyId')),
      ),
    [features],
  )
  const matches = useMemo(
    () => layoutMatches(es, assemblyManager),
    [es, assemblyManager],
  )

  const parsedCIGARs = useMemo(
    () => new Map(es.flat().map(f => [f.id(), parseCigar(f.get('CIGAR'))])),
    [es],
  )
  const drawCurves = parentView?.drawCurves
  const views = parentView?.views
  const offsets = views?.map(view => view.offsetPx)

  useEffect(
    () => {
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
      const ctx2 = clickMapRef.current.getContext('2d')
      const ctx3 = cigarClickMapRef.current.getContext('2d')

      if (!ctx1 || !ctx2 || !ctx3) {
        return
      }

      ctx2.imageSmoothingEnabled = false
      ctx3.imageSmoothingEnabled = false

      ctx1.resetTransform()
      ctx1.scale(highResolutionScaling, highResolutionScaling)
      ctx1.clearRect(0, 0, width, height)
      ctx2.clearRect(0, 0, width, height)
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
      for (let j = 0; j < matches.length; j++) {
        const m = matches[j]
        const idx = j * unitMultiplier + 1

        const r = Math.floor(idx / (255 * 255)) % 255
        const g = Math.floor(idx / 255) % 255
        const b = idx % 255
        ctx1.fillStyle = colorMap.M
        ctx1.strokeStyle = colorMap.M
        ctx2.fillStyle = `rgb(${r},${g},${b})`

        // too many click map false positives with colored stroked lines
        // ctx2.strokeStyle = `rgb(${r},${g},${b})`
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

          const px11 = px(v1, { refName: ref1, coord: f1.get('start') })
          const px12 = px(v1, { refName: ref1, coord: f1.get('end') })
          const px21 = px(v2, { refName: ref2, coord: f2.get('start') })
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

          // drawing a line if the results are thin results in much less
          // pixellation than filling in a thin polygon
          if (length1 < v1.bpPerPx || length2 < v2.bpPerPx) {
            ctx1.beginPath()
            ctx1.moveTo(x11, y1)
            if (drawCurves) {
              ctx1.bezierCurveTo(x11, mid, x21, mid, x21, y2)
            } else {
              ctx1.lineTo(x21, y2)
            }
            ctx1.stroke()
          } else {
            // flip the direction of the CIGAR drawing in horizontally flipped
            // modes
            const rev1 = x11 < x12 ? 1 : -1
            const rev2 = (x21 < x22 ? 1 : -1) * f1.get('strand')
            let cx1 = x11
            let cx2 = f1.get('strand') === -1 ? x22 : x21

            const cigar = parsedCIGARs.get(f1.id())

            if (cigar) {
              // continuingFlag helps speed up zoomed out by skipping draw
              // commands on very small CIGAR features
              let continuingFlag = false
              let px1 = 0
              let px2 = 0
              const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
              for (let j = 0; j < cigar.length; j += 2) {
                const idx = j * unitMultiplier2 + 1
                const r = Math.floor(idx / (255 * 255)) % 255
                const g = Math.floor(idx / 255) % 255
                const b = idx % 255
                ctx3.fillStyle = `rgb(${r},${g},${b})`
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

                    ctx1.beginPath()
                    ctx3.beginPath()
                    ctx1.moveTo(px1, y1)
                    ctx3.moveTo(px1, y1)
                    ctx1.lineTo(cx1, y1)
                    ctx3.lineTo(cx1, y1)
                    if (drawCurves) {
                      ctx1.bezierCurveTo(cx1, mid, cx2, mid, cx2, y2)
                      ctx3.bezierCurveTo(cx1, mid, cx2, mid, cx2, y2)
                    } else {
                      ctx1.lineTo(cx2, y2)
                      ctx3.lineTo(cx2, y2)
                    }
                    ctx1.lineTo(px2, y2)
                    ctx3.lineTo(px2, y2)
                    if (drawCurves) {
                      ctx1.bezierCurveTo(px2, mid, px1, mid, px1, y1)
                      ctx3.bezierCurveTo(px2, mid, px1, mid, px1, y1)
                    } else {
                      ctx1.lineTo(px1, y1)
                      ctx3.lineTo(px1, y1)
                    }
                    ctx1.closePath()
                    ctx3.closePath()
                    ctx1.fill()
                    ctx3.fill()
                  }
                }
              }
            } else {
              ctx1.beginPath()
              ctx1.moveTo(x11, y1)
              ctx1.lineTo(x12, y1)
              if (drawCurves) {
                ctx1.bezierCurveTo(x12, mid, x22, mid, x22, y2)
              } else {
                ctx1.lineTo(x22, y2)
              }
              ctx1.lineTo(x21, y2)
              if (drawCurves) {
                ctx1.bezierCurveTo(x21, mid, x11, mid, x11, y1)
              } else {
                ctx1.lineTo(x11, y1)
              }
              ctx1.closePath()
              ctx1.fill()
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      displayModel,
      highResolutionScaling,
      trackIds,
      width,
      drawCurves,
      color,
      height,
      matches,
      parsedCIGARs,
      // these are checked with a JSON.stringify to help compat with mobx
      JSON.stringify(views), // eslint-disable-line  react-hooks/exhaustive-deps
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
      trackIds,
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
          const cigar = parsedCIGARs.get(match1[0].feature.id()) || []
          const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
          const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
          const f1 = match1[0].feature
          const f2 = match1[1].feature
          const l1 = f1.get('end') - f1.get('start')
          const l2 = f2.get('end') - f2.get('start')
          const identity = f1.get('identity')
          const n1 = f1.get('name')
          const n2 = f2.get('name')
          const tooltip = [`Query len: ${l1}<br/>Target len: ${l2}`]
          if (identity) {
            tooltip.push(`Identity: ${identity}`)
          }
          if (identity) {
            // @ts-ignore
            tooltip.push(`Loc1: ${assembleLocString(f1.toJSON())}`)
            // @ts-ignore
            tooltip.push(`Loc2: ${assembleLocString(f2.toJSON())}`)
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
