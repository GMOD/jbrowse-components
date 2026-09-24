import { useRef, useState } from 'react'

import { getNotificationSink, stringify } from '@jbrowse/core/util'
import { getRelativeX } from '@jbrowse/core/util/getRelativeX'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RubberbandSpan from '../../shared/RubberbandSpan.tsx'
import { useWindowDrag } from '../../shared/useWindowDrag.ts'
import OverviewRubberbandHoverTooltip from './OverviewRubberbandHoverTooltip.tsx'
import { overviewPxToBp } from './util.ts'

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

  useWindowDrag(controlsRef, startX, {
    onMove: setCurrentX,
    onEnd: ({ startX, endX, isClick }) => {
      if (!isClick) {
        model.moveTo(
          overviewPxToBp(overview, Math.min(startX, endX), cytobandOffset),
          overviewPxToBp(overview, Math.max(startX, endX), cytobandOffset),
        )
      } else {
        const click = overviewPxToBp(overview, startX, cytobandOffset)
        if (click.refName) {
          model.centerAt(click.coord0, click.refName, click.index)
        } else {
          getNotificationSink(model).notify('unknown position clicked')
          console.error('unknown position clicked', click)
        }
      }
      setStartX(undefined)
      setCurrentX(undefined)
      setGuideX(undefined)
    },
    onCancel: () => {
      setStartX(undefined)
      setCurrentX(undefined)
    },
  })

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
          leftLabel={stringify(
            overviewPxToBp(overview, leftPx, cytobandOffset),
          )}
          rightLabel={stringify(
            overviewPxToBp(overview, rightPx, cytobandOffset),
          )}
          width={rightPx - leftPx}
          left={leftPx}
          viewWidth={overview.width}
          stickyTop={undefined}
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
