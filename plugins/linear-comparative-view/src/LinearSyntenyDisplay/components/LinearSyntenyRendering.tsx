import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import { getContainingView } from '@jbrowse/core/util'

// locals
import SyntenyTooltip from './SyntenyTooltip'
import { LinearSyntenyDisplayModel } from '../stateModelFactory'

function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const highResolutionScaling = 1
  const view = getContainingView(model)
  const height = view.middleComparativeHeight
  const width = view.width

  const [mouseoverId, setMouseoverId] = useState<number>()
  const [clickId, setClickId] = useState<number>()
  const [visibleCigarOp, setVisibleCigarOp] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [currY, setCurrY] = useState<number>()

  // draw mouseover shading on the mouseover'd ID
  // useEffect(
  //   () => {
  //     if (
  //       !mouseoverRef.current ||
  //       !offsets ||
  //       !views ||
  //       !isAlive(model)
  //     ) {
  //       return
  //     }
  //     const ctx = mouseoverRef.current.getContext('2d')
  //     if (!ctx) {
  //       return
  //     }
  //     ctx.resetTransform()
  //     ctx.scale(highResolutionScaling, highResolutionScaling)
  //     ctx.clearRect(0, 0, width, height)
  //     const showIntraviewLinks = false
  //     const hideTiny = false
  //     const viewSnaps = views.map(view => ({
  //       ...getSnapshot(view),
  //       staticBlocks: view.staticBlocks,
  //       width: view.width,
  //       interRegionPaddingWidth: view.interRegionPaddingWidth,
  //       minimumBlockWidth: view.minimumBlockWidth,
  //     }))

  //     if (mouseoverId !== undefined && matches[mouseoverId]) {
  //       const m = matches[mouseoverId]
  //       ctx.fillStyle = 'rgb(0,0,0,0.1)'
  //       drawMatchSimple({
  //         match: m,
  //         ctx,
  //         offsets,
  //         cb: ctx => ctx.fill(),
  //         showIntraviewLinks,
  //         height,
  //         hideTiny,
  //         viewSnaps,
  //         drawCurves,
  //       })
  //     }

  //     if (clickId !== undefined && matches[clickId]) {
  //       const m = matches[clickId]
  //       ctx.strokeStyle = 'rgb(0, 0, 0, 0.9)'
  //       drawMatchSimple({
  //         match: m,
  //         ctx,
  //         offsets,
  //         cb: ctx => ctx.stroke(),
  //         showIntraviewLinks,
  //         height,
  //         hideTiny,
  //         viewSnaps,
  //         drawCurves,
  //       })
  //     }
  // },
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // [
  //   model,
  //   highResolutionScaling,
  //   width,
  //   drawCurves,
  //   height,
  //   matches,
  //   parsedCIGARs,
  //   mouseoverId,
  //   clickId,
  //   // these are checked with a JSON.stringify to help compat with mobx
  //   JSON.stringify(views), // eslint-disable-line  react-hooks/exhaustive-deps
  //   JSON.stringify(offsets), // eslint-disable-line  react-hooks/exhaustive-deps
  // ],
  // )

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={ref => {
          if (isAlive(model)) {
            model.setMouseoverCanvasRef(ref)
          }
        }}
        width={width}
        height={height}
        style={{ width, height, position: 'absolute', pointerEvents: 'none' }}
      />
      <canvas
        ref={ref => {
          if (isAlive(model)) {
            model.setMainCanvasRef(ref)
          }
        }}
        onMouseMove={event => {
          // const ref1 = clickMapRef.current
          // const ref2 = cigarClickMapRef.current
          // if (!ref1 || !ref2) {
          //   return
          // }
          // const rect = ref1.getBoundingClientRect()
          // const ctx1 = ref1.getContext('2d')
          // const ctx2 = ref2.getContext('2d')
          // if (!ctx1 || !ctx2) {
          //   return
          // }
          // const { clientX, clientY } = event
          // const x = clientX - rect.left
          // const y = clientY - rect.top
          // setCurrX(clientX)
          // setCurrY(clientY)
          // const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
          // const [r2, g2, b2] = ctx2.getImageData(x, y, 1, 1).data
          // const unitMultiplier = Math.floor(MAX_COLOR_RANGE / matches.length)
          // const id = getId(r1, g1, b1, unitMultiplier)
          // const match1 = matches[id]
          // setMouseoverId(id < 0 ? undefined : id)
          // if (!match1) {
          //   setVisibleCigarOp('')
          //   return
          // }
          // const cigar = parsedCIGARs.get(match1[0].feature.uniqueId) || []
          // const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
          // const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
          // const f1 = match1[0].feature
          // const f2 = match1[1].feature
          // const l1 = f1.end - f1.start
          // const l2 = f2.end - f2.start
          // const identity = f1.identity
          // const n1 = f1.name
          // const n2 = f2.name
          // const tooltip = [`Query len: ${l1}<br/>Target len: ${l2}`]
          // if (identity) {
          //   tooltip.push(`Identity: ${identity}`)
          // }
          // if (identity) {
          //   tooltip.push(`Loc1: ${assembleLocString(f1)}`)
          //   tooltip.push(`Loc2: ${assembleLocString(f2)}`)
          // }
          // if (cigar[cigarIdx]) {
          //   tooltip.push(
          //     `CIGAR operator: ${cigar[cigarIdx]}${cigar[cigarIdx + 1]}`,
          //   )
          // }
          // if (n1 && n2) {
          //   tooltip.push(`Name 1: ${n1}`)
          //   tooltip.push(`Name 2: ${n2}`)
          // }
          // setVisibleCigarOp(tooltip.join('<br/>'))
        }}
        onMouseLeave={() => setMouseoverId(undefined)}
        onClick={event => {
          // const ref1 = clickMapRef.current
          // const ref2 = cigarClickMapRef.current
          // if (!ref1 || !ref2) {
          //   return
          // }
          // const rect = ref1.getBoundingClientRect()
          // const ctx1 = ref1.getContext('2d')
          // const ctx2 = ref2.getContext('2d')
          // if (!ctx1 || !ctx2) {
          //   return
          // }
          // const x = event.clientX - rect.left
          // const y = event.clientY - rect.top
          // const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
          // const unitMultiplier = Math.floor(MAX_COLOR_RANGE / matches.length)
          // const id = getId(r1, g1, b1, unitMultiplier)
          // const match1 = matches[id]
          // const session = getSession(model)
          // setClickId(id < 0 ? undefined : id)
          // if (match1 && isSessionModelWithWidgets(session)) {
          //   session.showWidget(
          //     session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
          //       featureData: {
          //         feature1: match1[0].feature,
          //         feature2: match1[1].feature,
          //       },
          //     }),
          //   )
          // }
        }}
        data-testid="synteny_canvas"
        style={{ width, height, position: 'absolute' }}
        width={width * highResolutionScaling}
        height={height * highResolutionScaling}
      />
      <canvas
        ref={ref => {
          if (isAlive(model)) {
            model.setCigarClickMapCanvasRef(ref)
          }
        }}
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
        ref={ref => {
          if (isAlive(model)) {
            model.setClickMapCanvasRef(ref)
          }
        }}
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
