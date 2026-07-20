import { useEffect, useRef, useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { pxToBp } from '@jbrowse/core/util/Base1DUtils'
import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import OverviewRubberbandHoverTooltip from './OverviewRubberbandHoverTooltip.tsx'
import RubberbandSpan from './RubberbandSpan.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

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
  overview: ViewLayout
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
    const el = controlsRef.current
    if (!mouseDragging || !el) {
      return
    }
    // the container's left edge is fixed for the duration of a drag, so measure
    // it once here rather than calling getBoundingClientRect on every mousemove
    const { left } = el.getBoundingClientRect()

    function globalMouseMove(event: MouseEvent) {
      setCurrentX(event.clientX - left)
    }

    function globalMouseUp(event: MouseEvent) {
      // read the up position from the event so currentX state doesn't need to
      // be a dep (which would re-subscribe these listeners every mousemove)
      if (startX !== undefined) {
        const offsetX = event.clientX - left
        if (Math.abs(offsetX - startX) > 3) {
          const leftPx = Math.min(startX, offsetX)
          const rightPx = Math.max(startX, offsetX)
          model.moveTo(
            pxToBp(overview, leftPx - cytobandOffset),
            pxToBp(overview, rightPx - cytobandOffset),
          )
        } else {
          const click = pxToBp(overview, startX - cytobandOffset)
          if (click.refName) {
            model.centerAt(click.coord0, click.refName, click.index)
          } else {
            getSession(model).notify('unknown position clicked')
            console.error('unknown position clicked', click)
          }
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

    window.addEventListener('mousemove', globalMouseMove)
    window.addEventListener('mouseup', globalMouseUp)
    window.addEventListener('keydown', globalKeyDown)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove)
      window.removeEventListener('mouseup', globalMouseUp)
      window.removeEventListener('keydown', globalKeyDown)
    }
  }, [startX, mouseDragging, model, overview, cytobandOffset])

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

  const endX = currentX ?? startX
  const leftPx = mouseDragging ? Math.min(startX, endX!) : 0
  const rightPx = mouseDragging ? Math.max(startX, endX!) : 0

  return (
    <div className={classes.rel}>
      {!mouseDragging && guideX !== undefined ? (
        <OverviewRubberbandHoverTooltip
          model={model}
          overview={overview}
          guideX={guideX}
        />
      ) : null}
      {mouseDragging ? (
        <RubberbandSpan
          leftBpOffset={pxToBp(overview, leftPx - cytobandOffset)}
          rightBpOffset={pxToBp(overview, rightPx - cytobandOffset)}
          width={rightPx - leftPx}
          left={leftPx}
        />
      ) : null}
      <div
        data-testid={mouseDragging ? 'rubberband_controls' : undefined}
        className={classes.rubberbandControl}
        ref={controlsRef}
        onMouseDown={mouseDown}
        onMouseLeave={mouseOut}
        onMouseMove={mouseMove}
      >
        {ControlComponent}
      </div>
    </div>
  )
})

export default OverviewRubberband
