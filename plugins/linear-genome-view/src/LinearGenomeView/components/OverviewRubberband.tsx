import React, { useRef, useEffect, useState } from 'react'
import { getSession, stringify } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import RubberbandSpan from './RubberbandSpan'
import { getRelativeX } from './util'
import type { LinearGenomeViewModel } from '..'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
  },
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    zIndex: 10,
  },
  rel: {
    position: 'relative',
  },
})

const HoverTooltip = observer(function ({
  model,
  open,
  guideX,
  overview,
}: {
  model: LGV
  open: boolean
  guideX: number
  overview: Base1DViewModel
}) {
  const { classes } = useStyles()
  const { cytobandOffset } = model
  const { assemblyManager } = getSession(model)

  const px = overview.pxToBp(guideX - cytobandOffset)
  const assembly = assemblyManager.get(px.assemblyName)
  const cytoband = assembly?.cytobands?.find(
    f =>
      px.coord > f.get('start') &&
      px.coord < f.get('end') &&
      px.refName === assembly.getCanonicalRefName(f.get('refName')),
  )

  return (
    <Tooltip
      open={open}
      placement="top"
      title={[stringify(px), cytoband?.get('name')].join(' ')}
      arrow
    >
      <div className={classes.guide} style={{ left: guideX }} />
    </Tooltip>
  )
})

const OverviewRubberband = observer(function OverviewRubberband({
  model,
  overview,
  ControlComponent = <div />,
}: {
  model: LGV
  overview: Base1DViewModel
  ControlComponent?: React.ReactElement
}) {
  const { cytobandOffset } = model
  const [startX, setStartX] = useState<number>()
  const [currentX, setCurrentX] = useState<number>()
  const [guideX, setGuideX] = useState<number>()
  const controlsRef = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  const mouseDragging = startX !== undefined

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      const ref = controlsRef.current
      if (ref && mouseDragging) {
        setCurrentX(getRelativeX(event, ref))
      }
    }

    function globalMouseUp() {
      // click and drag
      if (startX !== undefined && currentX !== undefined) {
        if (Math.abs(currentX - startX) > 3) {
          const left = Math.min(startX, currentX)
          const right = Math.max(startX, currentX)
          model.moveTo(
            overview.pxToBp(left - cytobandOffset),
            overview.pxToBp(right - cytobandOffset),
          )
        }
      }

      // just a click
      if (startX !== undefined && currentX === undefined) {
        const click = overview.pxToBp(startX - cytobandOffset)
        if (!click.refName) {
          getSession(model).notify('unknown position clicked')
          console.error('unknown position clicked', click)
        } else {
          model.centerAt(Math.round(click.coord), click.refName, click.index)
        }
      }
      setStartX(undefined)
      setCurrentX(undefined)

      if (startX !== undefined) {
        setGuideX(undefined)
      }
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStartX(undefined)
        setCurrentX(undefined)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      window.addEventListener('keydown', globalKeyDown, true)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
        window.removeEventListener('keydown', globalKeyDown, true)
      }
    }
    return () => {}
  }, [mouseDragging, currentX, startX, model, overview, cytobandOffset])

  function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setStartX(getRelativeX(event, controlsRef.current))
  }

  function mouseMove(event: React.MouseEvent<HTMLDivElement>) {
    setGuideX(getRelativeX(event, controlsRef.current))
  }

  function mouseOut() {
    setGuideX(undefined)
  }

  if (startX === undefined) {
    return (
      <div className={classes.rel}>
        {guideX !== undefined ? (
          <HoverTooltip
            model={model}
            open={!mouseDragging}
            overview={overview}
            guideX={guideX}
          />
        ) : null}
        <div
          className={classes.rubberbandControl}
          ref={controlsRef}
          onMouseDown={mouseDown}
          onMouseOut={mouseOut}
          onMouseMove={mouseMove}
        >
          {ControlComponent}
        </div>
      </div>
    )
  }

  let left = startX || 0
  let width = 0
  if (currentX !== undefined) {
    left = Math.min(currentX, startX)
    width = currentX - startX
  }
  // calculate the start and end bp of drag
  let leftBpOffset: ReturnType<typeof overview.pxToBp> | undefined
  let rightBpOffset: ReturnType<typeof overview.pxToBp> | undefined
  if (startX) {
    leftBpOffset = overview.pxToBp(startX - cytobandOffset)
    rightBpOffset = overview.pxToBp(startX + width - cytobandOffset)
    if (currentX !== undefined && currentX < startX) {
      ;[leftBpOffset, rightBpOffset] = [rightBpOffset, leftBpOffset]
    }
  }

  return (
    <div className={classes.rel}>
      {leftBpOffset && rightBpOffset ? (
        <RubberbandSpan
          leftBpOffset={leftBpOffset}
          rightBpOffset={rightBpOffset}
          width={Math.abs(width)}
          left={left}
        />
      ) : null}
      <div
        data-testid="rubberband_controls"
        className={classes.rubberbandControl}
        ref={controlsRef}
        onMouseDown={mouseDown}
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
      >
        {ControlComponent}
      </div>
    </div>
  )
})

export default OverviewRubberband
