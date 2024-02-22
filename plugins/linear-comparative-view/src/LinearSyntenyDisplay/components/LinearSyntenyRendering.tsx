import React, { useState, useCallback, useRef } from 'react'
import { observer } from 'mobx-react'
import {
  assembleLocString,
  Feature,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { transaction } from 'mobx'
import { makeStyles } from 'tss-react/mui'

// locals
import SyntenyTooltip from './SyntenyTooltip'
import { LinearSyntenyDisplayModel } from '../model'
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import SyntenyContextMenu from './SyntenyContextMenu'

const useStyles = makeStyles()({
  pix: {
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    visibility: 'hidden',
    position: 'absolute',
  },
  rel: {
    position: 'relative',
  },
  abs: {
    position: 'absolute',
  },
  none: {
    pointEvents: 'none',
  },
})

interface ClickCoord {
  clientX: number
  clientY: number
  feature: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const LinearSyntenyRendering = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes, cx } = useStyles()
  const xOffset = useRef(0)
  const currScrollFrame = useRef<number>()
  const view = getContainingView(model) as LinearSyntenyViewModel
  const height = view.middleComparativeHeight
  const width = view.width
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()
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
    <div className={classes.rel}>
      <canvas
        ref={k1}
        width={width}
        height={height}
        className={cx(classes.abs, classes.none)}
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
          if (mouseCurrDownX !== undefined) {
            xOffset.current += mouseCurrDownX - event.clientX
            setMouseCurrDownX(event.clientX)
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
          } else {
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
              const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
              const cigarIdx = getId(r2, g2, b2, unitMultiplier2)
              setTooltip(getTooltip(f, cigar[cigarIdx], cigar[cigarIdx + 1]))
            }
          }
        }}
        onMouseLeave={() => {
          model.setMouseoverId(undefined)
          setMouseInitialDownX(undefined)
          setMouseCurrDownX(undefined)
        }}
        onMouseDown={evt => {
          setMouseCurrDownX(evt.clientX)
          setMouseInitialDownX(evt.clientX)
        }}
        onMouseUp={evt => {
          setMouseCurrDownX(undefined)
          if (
            mouseInitialDownX !== undefined &&
            Math.abs(evt.clientX - mouseInitialDownX) < 5
          ) {
            onSyntenyClick(evt, model)
          }
        }}
        onContextMenu={evt => {
          onSyntenyContextClick(evt, model, setAnchorEl)
        }}
        data-testid="synteny_canvas"
        className={classes.abs}
        width={width}
        height={height}
      />
      <canvas ref={k3} className={classes.pix} width={width} height={height} />
      <canvas ref={k4} className={classes.pix} width={width} height={height} />
      {model.mouseoverId && tooltip && currX && currY ? (
        <SyntenyTooltip title={tooltip} />
      ) : null}
      {anchorEl ? (
        <SyntenyContextMenu
          model={model}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(undefined)}
        />
      ) : null}
    </div>
  )
})

function onSyntenyClick(
  event: React.MouseEvent,
  model: LinearSyntenyDisplayModel,
) {
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
  const feat = model.featPositions[id]
  if (feat) {
    const { f } = feat
    model.setClickId(f.id())
    const session = getSession(model)
    if (isSessionModelWithWidgets(session)) {
      session.showWidget(
        session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
          featureData: {
            feature1: f.toJSON(),
            feature2: f.get('mate'),
          },
        }),
      )
    }
  }
  return feat
}

function onSyntenyContextClick(
  event: React.MouseEvent,
  model: LinearSyntenyDisplayModel,
  setAnchorEl: (arg: ClickCoord) => void,
) {
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
}

function getTooltip(f: Feature, cigarOp?: string, cigarOpLen?: string) {
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
  const l1 = f1.end - f1.start
  const l2 = f2.end - f2.start
  const identity = f1.identity
  const n1 = f1.name
  const n2 = f2.name
  return [
    `Loc1: ${assembleLocString(f1)}`,
    `Loc2: ${assembleLocString(f2)}`,
    `Inverted: ${f1.strand === -1}`,
    `Query len: ${l1.toLocaleString('en-US')}`,
    `Target len: ${l2.toLocaleString('en-US')}`,
    identity ? `Identity: ${identity.toPrecision(2)}` : '',
    cigarOp ? `CIGAR operator: ${cigarOp}${cigarOpLen}` : '',
    n1 ? `Name 1: ${n1}` : '',
    n2 ? `Name 1: ${n2}` : '',
  ]
    .filter(f => !!f)
    .join('<br/>')
}

export default LinearSyntenyRendering
