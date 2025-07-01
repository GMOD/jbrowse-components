import { useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import RubberbandSpan from './RubberbandSpan'
import VerticalGuide from './VerticalGuide'
import { useRangeSelect } from './useRangeSelect'

import type { LinearComparativeViewModel } from '..'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
    position: 'relative',
    zIndex: 900,
  },
})

const Rubberband = observer(function ({
  model,
  ControlComponent = <div />,
}: {
  model: LCV
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
    open,
    handleMenuItemClick,
    handleClose,
    mouseMove,
    mouseDown,
    mouseOut,
  } = useRangeSelect(ref, model)

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
