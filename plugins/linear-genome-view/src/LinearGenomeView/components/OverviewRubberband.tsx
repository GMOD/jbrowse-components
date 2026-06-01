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
    if (!mouseDragging) {
      return
    }
    function globalMouseMove(event: MouseEvent) {
      if (controlsRef.current) {
        setCurrentX(getRelativeX(event, controlsRef.current))
      }
    }

    function globalMouseUp() {
      // click and drag
      if (startX !== undefined && currentX !== undefined) {
        if (Math.abs(currentX - startX) > 3) {
          const left = Math.min(startX, currentX)
          const right = Math.max(startX, currentX)
          model.moveTo(
            pxToBp(overview, left - cytobandOffset),
            pxToBp(overview, right - cytobandOffset),
          )
        }
      }

      // just a click
      if (startX !== undefined && currentX === undefined) {
        const click = pxToBp(overview, startX - cytobandOffset)
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

    window.addEventListener('mousemove', globalMouseMove)
    window.addEventListener('mouseup', globalMouseUp)
    window.addEventListener('keydown', globalKeyDown)
    return () => {
      window.removeEventListener('mousemove', globalMouseMove)
      window.removeEventListener('mouseup', globalMouseUp)
      window.removeEventListener('keydown', globalKeyDown)
    }
  }, [startX, currentX, mouseDragging, model, overview, cytobandOffset])

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
        onMouseOut={mouseOut}
        onMouseMove={mouseMove}
      >
        {ControlComponent}
      </div>
    </div>
  )
})

export default OverviewRubberband
