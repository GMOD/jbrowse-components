import { useEffect, useRef, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import OverviewRubberbandHoverTooltip from './OverviewRubberbandHoverTooltip.tsx'
import RubberbandSpan from './RubberbandSpan.tsx'
import { getRelativeX } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
  },
  rel: {
    position: 'relative',
  },
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

  // refs let globalMouseUp read the latest values without forcing the effect
  // below to re-register listeners on every drag movement
  const startXRef = useRef(startX)
  const currentXRef = useRef(currentX)
  startXRef.current = startX
  currentXRef.current = currentX

  useEffect(() => {
    if (!mouseDragging) {
      return
    }

    function globalMouseMove(event: MouseEvent) {
      const ref = controlsRef.current
      if (ref) {
        setCurrentX(getRelativeX(event, ref))
      }
    }

    function globalMouseUp() {
      const sx = startXRef.current
      const cx = currentXRef.current
      // click and drag
      if (sx !== undefined && cx !== undefined) {
        if (Math.abs(cx - sx) > 3) {
          const left = Math.min(sx, cx)
          const right = Math.max(sx, cx)
          model.moveTo(
            overview.pxToBp(left - cytobandOffset),
            overview.pxToBp(right - cytobandOffset),
          )
        }
      }

      // just a click
      if (sx !== undefined && cx === undefined) {
        const click = overview.pxToBp(sx - cytobandOffset)
        if (!click.refName) {
          getSession(model).notify('unknown position clicked')
          console.error('unknown position clicked', click)
        } else {
          model.centerAt(Math.round(click.coord), click.refName, click.index)
        }
      }
      setStartX(undefined)
      setCurrentX(undefined)
      setGuideX(undefined)
    }

    function globalKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setStartX(undefined)
        setCurrentX(undefined)
      }
    }

    window.addEventListener('mousemove', globalMouseMove, true)
    window.addEventListener('mouseup', globalMouseUp, true)
    window.addEventListener('keydown', globalKeyDown, true)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove, true)
      window.removeEventListener('mouseup', globalMouseUp, true)
      window.removeEventListener('keydown', globalKeyDown, true)
    }
  }, [mouseDragging, model, overview, cytobandOffset])

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
          <OverviewRubberbandHoverTooltip
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

  let left = startX
  let width = 0
  if (currentX !== undefined) {
    left = Math.min(currentX, startX)
    width = currentX - startX
  }
  // calculate the start and end bp of drag
  let leftBpOffset = overview.pxToBp(startX - cytobandOffset)
  let rightBpOffset = overview.pxToBp(startX + width - cytobandOffset)
  if (currentX !== undefined && currentX < startX) {
    ;[leftBpOffset, rightBpOffset] = [rightBpOffset, leftBpOffset]
  }

  return (
    <div className={classes.rel}>
      <RubberbandSpan
        leftBpOffset={leftBpOffset}
        rightBpOffset={rightBpOffset}
        width={Math.abs(width)}
        left={left}
      />
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
