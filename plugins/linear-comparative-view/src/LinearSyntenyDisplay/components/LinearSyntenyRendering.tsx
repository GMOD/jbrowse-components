import React, { useState, useCallback, useRef, lazy, useEffect } from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'
import SyntenyContextMenu from './SyntenyContextMenu'
import { getTooltip, onSynClick, onSynContextClick } from './util'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'
import type { ClickCoord } from './util'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip'))

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
  mouseoverCanvas: {
    position: 'absolute',
    pointEvents: 'none',
  },
  mainCanvas: {
    position: 'absolute',
  },
})

const LinearSyntenyRendering = observer(function ({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { classes } = useStyles()
  const { mouseoverId, height } = model
  const xOffset = useRef(0)
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width
  const delta = useRef(0)
  const scheduled = useRef(false)
  const timeout = useRef<Timer>()
  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const mainSyntenyCanvasRefp = useRef<HTMLCanvasElement | null>()

  // these useCallbacks avoid new refs from being created on any mouseover,
  // etc.
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mouseoverDetectionCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMouseoverCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const mainSyntenyCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setMainCanvasRef(ref)
      mainSyntenyCanvasRefp.current = ref // this ref is additionally used in useEffect below
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      if (event.ctrlKey) {
        delta.current += event.deltaY / 500
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
              event.clientX -
                (mainSyntenyCanvasRefp.current?.getBoundingClientRect().left ||
                  0),
            )
          }
          delta.current = 0
        }, 300)
      } else {
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
          xOffset.current += event.deltaX / 2
        }
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            transaction(() => {
              for (const v of view.views) {
                v.horizontalScroll(xOffset.current)
              }
              xOffset.current = 0
              scheduled.current = false
            })
          })
        }
      }
    }
    mainSyntenyCanvasRefp.current?.addEventListener('wheel', onWheel)
    return () => {
      mainSyntenyCanvasRefp.current?.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, height, width])

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const clickMapCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setClickMapCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cigarClickMapCanvasRef = useCallback(
    (ref: HTMLCanvasElement | null) => {
      model.setCigarClickMapCanvasRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, height, width],
  )

  return (
    <div className={classes.rel}>
      <canvas
        ref={mouseoverDetectionCanvasRef}
        width={width}
        height={height}
        className={classes.mouseoverCanvas}
      />
      <canvas
        ref={mainSyntenyCanvasRef}
        onMouseMove={event => {
          if (mouseCurrDownX !== undefined) {
            xOffset.current += mouseCurrDownX - event.clientX
            setMouseCurrDownX(event.clientX)
            if (!scheduled.current) {
              scheduled.current = true
              window.requestAnimationFrame(() => {
                transaction(() => {
                  for (const v of view.views) {
                    v.horizontalScroll(xOffset.current)
                  }
                  xOffset.current = 0
                  scheduled.current = false
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
            const id = getId(r1!, g1!, b1!, unitMultiplier)
            model.setMouseoverId(model.featPositions[id]?.f.id())
            if (id === -1) {
              setTooltip('')
            } else if (model.featPositions[id]) {
              const { f, cigar } = model.featPositions[id]
              const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
              const cigarIdx = getId(r2!, g2!, b2!, unitMultiplier2)
              setTooltip(
                getTooltip({
                  feature: f,
                  cigarOp: cigar[cigarIdx],
                  cigarOpLen: cigar[cigarIdx + 1],
                }),
              )
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
        onContextMenu={evt => {
          onSynContextClick(evt, model, setAnchorEl)
        }}
        data-testid="synteny_canvas"
        className={classes.mainCanvas}
        width={width}
        height={height}
      />
      <canvas
        ref={clickMapCanvasRef}
        className={classes.pix}
        width={width}
        height={height}
      />
      <canvas
        ref={cigarClickMapCanvasRef}
        className={classes.pix}
        width={width}
        height={height}
      />
      {mouseoverId && tooltip && currX && currY ? (
        <SyntenyTooltip title={tooltip} />
      ) : null}
      {anchorEl ? (
        <SyntenyContextMenu
          model={model}
          anchorEl={anchorEl}
          onClose={() => {
            setAnchorEl(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default LinearSyntenyRendering
