import { lazy, useCallback, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { MAX_COLOR_RANGE, getId } from '../drawSynteny'
import MainSyntenyCanvas from './MainSyntenyCanvas'
import MouseoverCanvas from './MouseoverCanvas'
import SyntenyContextMenu from './SyntenyContextMenu'
import { getTooltip, onSynClick, onSynContextClick } from './util'

import type { ClickCoord } from './util'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip'))

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
  const view = getContainingView(model) as LinearSyntenyViewModel
  const width = view.width
  const xOffset = useRef(0)
  const scheduled = useRef(false)

  const [anchorEl, setAnchorEl] = useState<ClickCoord>()
  const [tooltip, setTooltip] = useState('')
  const [currX, setCurrX] = useState<number>()
  const [currY, setCurrY] = useState<number>()
  const [mouseCurrDownX, setMouseCurrDownX] = useState<number>()
  const [mouseInitialDownX, setMouseInitialDownX] = useState<number>()

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

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
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
          const hasCigarData =
            cigarIdx % 2 === 0 && (r2 !== 0 || g2 !== 0 || b2 !== 0)
          setTooltip(
            getTooltip({
              feature: f,
              cigarOp: hasCigarData ? cigar[cigarIdx + 1] : undefined,
              cigarOpLen: hasCigarData ? cigar[cigarIdx] : undefined,
            }),
          )
        }
      }
    },
    [model, mouseCurrDownX, view.views],
  )

  const handleMouseLeave = useCallback(() => {
    model.setMouseoverId(undefined)
    setMouseInitialDownX(undefined)
    setMouseCurrDownX(undefined)
  }, [model])

  const handleMouseDown = useCallback((evt: React.MouseEvent) => {
    setMouseCurrDownX(evt.clientX)
    setMouseInitialDownX(evt.clientX)
  }, [])

  const handleMouseUp = useCallback(
    (evt: React.MouseEvent) => {
      setMouseCurrDownX(undefined)
      if (
        mouseInitialDownX !== undefined &&
        Math.abs(evt.clientX - mouseInitialDownX) < 5
      ) {
        onSynClick(evt, model)
      }
    },
    [model, mouseInitialDownX],
  )

  const handleContextMenu = useCallback(
    (evt: React.MouseEvent) => {
      onSynContextClick(evt, model, setAnchorEl)
    },
    [model],
  )

  return (
    <div className={classes.rel} style={{ width, height }}>
      <MouseoverCanvas
        model={model}
        width={width}
        height={height}
        className={classes.mouseoverCanvas}
      />
      <MainSyntenyCanvas
        model={model}
        width={width}
        height={height}
        className={classes.mainCanvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
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
