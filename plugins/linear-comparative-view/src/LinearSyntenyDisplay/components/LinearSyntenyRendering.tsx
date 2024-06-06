import React, { useState, useCallback, useRef } from 'react'
import normalizeWheel from 'normalize-wheel'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { transaction } from 'mobx'
import { makeStyles } from 'tss-react/mui'

// locals
import SyntenyTooltip from './SyntenyTooltip'
import { LinearSyntenyDisplayModel } from '../model'
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'
import { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import SyntenyContextMenu from './SyntenyContextMenu'
import { ClickCoord, getTooltip, onSynClick, onSynContextClick } from './util'

type Timer = ReturnType<typeof setTimeout>

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
  const delta = useRef(0)
  const timeout = useRef<Timer>()
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const { mouseoverId } = model

  // these useCallbacks avoid new refs from being created on any mouseover, etc.
  const k1 = useCallback(
    (ref: HTMLCanvasElement) => model.setMouseoverCanvasRef(ref),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  const k2 = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setMainCanvasRef(ref)
      function onWheel(origEvent: WheelEvent) {
        const event = normalizeWheel(origEvent)
        origEvent.preventDefault()
        if (origEvent.ctrlKey === true) {
          delta.current += event.pixelY / 500
          for (const v of view.views) {
            v.setScaleFactor(
              delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
            )
          }
          if (timeout.current) {
            clearTimeout(timeout.current)
          }
          timeout.current = setTimeout(() => {
            for (const v of view.views) {
              v.setScaleFactor(1)
              v.zoomTo(
                delta.current > 0
                  ? v.bpPerPx * (1 + delta.current)
                  : v.bpPerPx / (1 - delta.current),
                origEvent.clientX - (ref?.getBoundingClientRect().left || 0),
              )
            }
            delta.current = 0
          }, 300)
        } else {
          if (Math.abs(event.pixelY) < Math.abs(event.pixelX)) {
            xOffset.current += origEvent.deltaX
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
        }
      }
      if (ref) {
        ref.addEventListener('wheel', onWheel)

        // this is a react 19-ism to have a cleanup in the ref callback
        // https://react.dev/blog/2024/04/25/react-19#cleanup-functions-for-refs
        // note: it warns in earlier versions of react
        return () => ref.removeEventListener('wheel', onWheel)
      }
      return () => {}
    },
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
            onSynClick(evt, model)
          }
        }}
        onContextMenu={evt => onSynContextClick(evt, model, setAnchorEl)}
        data-testid="synteny_canvas"
        className={classes.abs}
        width={width}
        height={height}
      />
      <canvas ref={k3} className={classes.pix} width={width} height={height} />
      <canvas ref={k4} className={classes.pix} width={width} height={height} />
      {mouseoverId && tooltip && currX && currY ? (
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

export default LinearSyntenyRendering
