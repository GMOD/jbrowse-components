import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { Menu, VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'

// locals
import VerticalGuide from './VerticalGuide'
import RubberbandSpan from './RubberbandSpan'
import { useRangeSelect } from './hooks'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  LinearGenomeViewModel,
} from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
    position: 'sticky',
    zIndex: 3,
  },
})

const Rubberband = observer(function ({
  model,
  ControlComponent = <div />,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()

  const {
    guideX,
    rubberbandOn,
    leftBpOffset,
    rightBpOffset,
    numOfBpSelected,
    width,
    left,
    anchorPosition,
    handleMenuItemClick,
    open,
    handleClose,
    mouseMove,
    mouseDown,
    mouseOut,
  } = useRangeSelect(ref, model)

  let rubberbandControlTop = VIEW_HEADER_HEIGHT
  if (!model.hideHeader) {
    rubberbandControlTop += HEADER_BAR_HEIGHT
    if (!model.hideHeaderOverview) {
      rubberbandControlTop += HEADER_OVERVIEW_HEIGHT
    }
  }

  return (
    <>
      {guideX !== undefined ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn ? (
        <RubberbandSpan
          leftBpOffset={leftBpOffset}
          rightBpOffset={rightBpOffset}
          numOfBpSelected={numOfBpSelected}
          width={width}
          left={left}
          top={rubberbandControlTop}
        />
      ) : null}
      {anchorPosition ? (
        <Menu
          anchorReference="anchorPosition"
          anchorPosition={{
            left: anchorPosition.clientX,
            top: anchorPosition.clientY,
          }}
          onMenuItemClick={handleMenuItemClick}
          open={open}
          onClose={handleClose}
          menuItems={model.rubberBandMenuItems()}
        />
      ) : null}
      <div
        data-testid="rubberband_controls"
        className={classes.rubberbandControl}
        style={{ top: rubberbandControlTop }}
        ref={ref}
        onMouseDown={mouseDown}
        onMouseMove={mouseMove}
        onMouseOut={mouseOut}
      >
        {ControlComponent}
      </div>
    </>
  )
})

export default Rubberband
