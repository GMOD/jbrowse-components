import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import {
  assembleLocString,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

// locals
import SyntenyTooltip from './SyntenyTooltip'
import { LinearSyntenyDisplayModel } from '../stateModelFactory'
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'

export default observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const highResolutionScaling = 1
  const view = getContainingView(model)
  const height = view.middleComparativeHeight
  const width = view.width

  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [currY, setCurrY] = useState<number>()

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
          const ref1 = model.clickMapCanvas
          const ref2 = model.cigarClickMapCanvas
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
          const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
          const id = getId(r1, g1, b1, unitMultiplier)
          model.setMouseoverId(id)
          if (id === -1) {
            setTooltip('')
          } else if (model.featPositions[id]) {
            const { f, cigar } = model.featPositions[id]
            // @ts-ignore
            const f1 = f.toJSON() as {
              refName: string
              start: number
              end: number
              assemblyName: string
              identity?: number
              name?: string
            }
            // @ts-ignore
            const f2 = f1.mate
            const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
            const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
            const l1 = f1.end - f1.start
            const l2 = f2.end - f2.start
            const identity = f1.identity
            const n1 = f1.name
            const n2 = f2.name
            const tooltip = [`Query len: ${l1}<br/>Target len: ${l2}`]
            if (identity) {
              tooltip.push(`Identity: ${identity}`)
            }
            tooltip.push(`Loc1: ${assembleLocString(f1)}`)
            tooltip.push(`Loc2: ${assembleLocString(f2)}`)

            if (cigar[cigarIdx]) {
              tooltip.push(
                `CIGAR operator: ${cigar[cigarIdx]}${cigar[cigarIdx + 1]}`,
              )
            }
            if (n1 && n2) {
              tooltip.push(`Name 1: ${n1}`)
              tooltip.push(`Name 2: ${n2}`)
            }
            setTooltip(tooltip.join('<br/>'))
          }
        }}
        onMouseLeave={() => model.setMouseoverId(-1)}
        onClick={event => {
          const ref1 = model.clickMapCanvas
          const ref2 = model.cigarClickMapCanvas
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
          const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
          const id = getId(r1, g1, b1, unitMultiplier)
          model.setClickId(id)
          const f = model.featPositions[id - 1]
          const session = getSession(model)
          if (f && isSessionModelWithWidgets(session)) {
            session.showWidget(
              session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
                featureData: {
                  feature1: f.f.toJSON(),
                  feature2: f.f.get('mate'),
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
      {model.mouseoverId !== -1 && tooltip && currX && currY ? (
        <SyntenyTooltip x={currX} y={currY} title={tooltip} />
      ) : null}
    </div>
  )
})
