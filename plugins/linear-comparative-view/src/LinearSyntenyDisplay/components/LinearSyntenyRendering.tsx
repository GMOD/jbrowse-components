import React, { useState, useCallback, useRef } from 'react'
import { observer } from 'mobx-react'
import {
  assembleLocString,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import { transaction } from 'mobx'

// locals
import SyntenyTooltip from './SyntenyTooltip'
import { LinearSyntenyDisplayModel } from '../model'
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'

interface ClickCoord {
  clientX: number
  clientY: number
  feature: any
}

const LinearSyntenyRendering = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const highResolutionScaling = 1
  const xOffset = useRef(0)
  const currScrollFrame = useRef<number>()
  const view = getContainingView(model) as LinearSyntenyViewModel
  const height = view.middleComparativeHeight
  const width = view.width
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()

  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [currY, setCurrY] = useState<number>()

  // these useCallbacks avoid new refs from being created on any mouseover, etc.
  const k1 = useCallback(
    (ref: HTMLCanvasElement) => model.setMouseoverCanvasRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  const k2 = useCallback(
    (ref: HTMLCanvasElement) => model.setMainCanvasRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  const k3 = useCallback(
    (ref: HTMLCanvasElement) => model.setClickMapCanvasRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  const k4 = useCallback(
    (ref: HTMLCanvasElement) => model.setCigarClickMapCanvasRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={k1}
        width={width}
        height={height}
        style={{
          width,
          height,
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={k2}
        onWheel={event => {
          if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
            xOffset.current += event.deltaX
          }
          if (currScrollFrame.current === undefined) {
            currScrollFrame.current = requestAnimationFrame(() => {
              transaction(() => {
                for (const v of view.views) {
                  v.horizontalScroll(xOffset.current)
                }
                xOffset.current = 0
                currScrollFrame.current = undefined
              })
            })
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
          model.setMouseoverId(model.featPositions[id]?.f.id())
          if (id === -1) {
            setTooltip('')
          } else if (model.featPositions[id]) {
            const { f, cigar } = model.featPositions[id]
            // @ts-expect-error
            const f1 = f.toJSON() as {
              refName: string
              start: number
              end: number
              strand?: number
              assemblyName: string
              identity?: number
              name?: string
              mate: {
                start: number
                end: number
                refName: string
                name: string
              }
            }
            const f2 = f1.mate
            const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
            const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
            const l1 = f1.end - f1.start
            const l2 = f2.end - f2.start
            const identity = f1.identity
            const n1 = f1.name
            const n2 = f2.name
            const tooltip = [
              `Loc1: ${assembleLocString(f1)}`,
              `Loc2: ${assembleLocString(f2)}`,
              `Inverted: ${f1.strand === -1}`,
              `Query len: ${l1}`,
              `Target len: ${l2}`,
            ]
            if (identity) {
              tooltip.push(`Identity: ${identity}`)
            }

            if (cigar[cigarIdx]) {
              tooltip.push(
                `CIGAR operator: ${cigar[cigarIdx]}${cigar[cigarIdx + 1]}`,
              )
            }
            if (n1 && n2) {
              tooltip.push(`Name 1: ${n1}`, `Name 2: ${n2}`)
            }
            setTooltip(tooltip.join('<br/>'))
          }
        }}
        onMouseLeave={() => model.setMouseoverId(undefined)}
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
          const f = model.featPositions[id]
          if (!f) {
            return
          }
          model.setClickId(f.f.id())
          const session = getSession(model)
          if (isSessionModelWithWidgets(session)) {
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
        onContextMenu={event => {
          event.preventDefault()
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
          const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
          const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
          const id = getId(r1, g1, b1, unitMultiplier)
          const f = model.featPositions[id]
          if (f) {
            model.setClickId(f.f.id())
            setAnchorEl({ clientX, clientY, feature: f })
          }
        }}
        data-testid="synteny_canvas"
        style={{ width, height, position: 'absolute' }}
        width={width * highResolutionScaling}
        height={height * highResolutionScaling}
      />
      <canvas
        ref={k3}
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
        ref={k4}
        style={{
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          visibility: 'hidden',
          position: 'absolute',
        }}
        width={width}
        height={height}
      />
      {model.mouseoverId && tooltip && currX && currY ? (
        <SyntenyTooltip title={tooltip} />
      ) : null}
      {anchorEl ? (
        <Menu
          onMenuItemClick={(event, callback) => {
            callback(event)
            setAnchorEl(undefined)
          }}
          anchorEl={{
            nodeType: 1,
            getBoundingClientRect: () => {
              const x = anchorEl.clientX
              const y = anchorEl.clientY
              return {
                top: y,
                left: x,
                bottom: y,
                right: x,
                width: 0,
                height: 0,
                x,
                y,
                toJSON() {},
              }
            },
          }}
          onClose={() => setAnchorEl(undefined)}
          open={Boolean(anchorEl)}
          menuItems={[
            {
              label: 'Center on feature',
              onClick: () => {
                const {
                  feature: { f },
                } = anchorEl
                const start = f.get('start')
                const end = f.get('end')
                const refName = f.get('refName')
                const mate = f.get('mate')
                view.views[0]
                  .navToLocString(`${refName}:${start}-${end}`)
                  .catch(e => {
                    console.error(e)
                    getSession(model).notify(`${e}`, 'error')
                  })
                view.views[1]
                  .navToLocString(`${mate.refName}:${mate.start}-${mate.end}`)
                  .catch(e => {
                    console.error(e)
                    getSession(model).notify(`${e}`, 'error')
                  })
              },
            },
          ]}
        />
      ) : null}
    </div>
  )
})

export default LinearSyntenyRendering
