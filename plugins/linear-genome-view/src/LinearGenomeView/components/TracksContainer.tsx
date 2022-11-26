import React, { useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { Menu } from '@jbrowse/core/ui'

// local utils
import { LinearGenomeViewModel, SCALE_BAR_HEIGHT } from '..'
import { useSideScroll, useShiftSelect, useWheelScroll } from './hooks'

// local components
import Rubberband from './Rubberband'
import Scalebar from './Scalebar'
import Gridlines from './Gridlines'
import CenterLine from './CenterLine'
import VerticalGuide from './VerticalGuide'
import RubberbandSpan from './RubberbandSpan'

const useStyles = makeStyles()({
  tracksContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  spacer: {
    position: 'relative',
    height: 3,
  },
})

type LGV = LinearGenomeViewModel

function TracksContainer({
  children,
  model,
}: {
  children: React.ReactNode
  model: LGV
}) {
  const { classes } = useStyles()
  const { mouseDown: mouseDown1, mouseUp } = useSideScroll(model)
  const ref = useRef<HTMLDivElement>(null)
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
    mouseDown: mouseDown2,
  } = useShiftSelect(ref, model, true)
  useWheelScroll(ref, model)

  return (
    <div
      ref={ref}
      data-testid="trackContainer"
      className={classes.tracksContainer}
      onMouseDown={event => {
        mouseDown1(event)
        mouseDown2(event)
      }}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
    >
      {model.showGridlines ? <Gridlines model={model} /> : null}
      {model.showCenterLine ? <CenterLine model={model} /> : null}
      {guideX !== undefined ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn ? (
        <RubberbandSpan
          leftBpOffset={leftBpOffset}
          rightBpOffset={rightBpOffset}
          numOfBpSelected={numOfBpSelected}
          width={width}
          left={left}
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

      <Rubberband
        model={model}
        ControlComponent={
          <Scalebar
            model={model}
            style={{ height: SCALE_BAR_HEIGHT, boxSizing: 'border-box' }}
          />
        }
      />
      {children}
    </div>
  )
}

export default observer(TracksContainer)
