import { useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RubberbandSpan from './RubberbandSpan.tsx'
import VerticalGuide from './VerticalGuide.tsx'
import { useRangeSelect } from './useRangeSelect.ts'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
    zIndex: 825,
  },
})

const Rubberband = observer(function Rubberband({
  model,
  ControlComponent = <div />,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  const { stickyViewHeaders, rubberbandTop, isScalebarRefNameMenuOpen } = model

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
    isClick,
    clickBpOffset,
    handleMenuItemClick,
    handleClose,
    mouseMove,
    mouseDown,
    mouseOut,
  } = useRangeSelect(ref, model)

  return (
    <>
      {guideX !== undefined && !isScalebarRefNameMenuOpen ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn ? (
        <RubberbandSpan
          leftBpOffset={leftBpOffset}
          rightBpOffset={rightBpOffset}
          numOfBpSelected={numOfBpSelected}
          width={width}
          left={left}
          top={rubberbandTop}
          sticky={stickyViewHeaders}
        />
      ) : null}
      {anchorPosition ? (
        <Menu
          anchorReference="anchorPosition"
          anchorPosition={{
            left: anchorPosition.clientX + 10,
            top: anchorPosition.clientY,
          }}
          onMenuItemClick={handleMenuItemClick}
          open={open}
          onClose={handleClose}
          menuItems={
            isClick && clickBpOffset
              ? model.rubberbandClickMenuItems(clickBpOffset)
              : model.rubberBandMenuItems()
          }
        />
      ) : null}
      <div
        data-testid="rubberband_controls"
        className={classes.rubberbandControl}
        style={{
          top: rubberbandTop,
          position: stickyViewHeaders ? 'sticky' : undefined,
        }}
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
