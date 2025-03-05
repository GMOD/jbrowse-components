import { useRef } from 'react'

import { Menu, VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { isSessionWithMultipleViews } from '@jbrowse/product-core'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import RubberbandSpan from './RubberbandSpan'
import VerticalGuide from './VerticalGuide'
// hooks
import { useRangeSelect } from './useRangeSelect'
import { HEADER_BAR_HEIGHT, HEADER_OVERVIEW_HEIGHT } from '../consts'

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

const Rubberband = observer(function ({
  model,
  ControlComponent = <div />,
}: {
  model: LGV
  ControlComponent?: React.ReactElement
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()
  const session = getSession(model)

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

  let stickyViewHeaders = false
  if (isSessionWithMultipleViews(session)) {
    ;({ stickyViewHeaders } = session)
  }

  let rubberbandControlTop = 0
  if (stickyViewHeaders) {
    rubberbandControlTop = VIEW_HEADER_HEIGHT
    if (!model.hideHeader) {
      rubberbandControlTop += HEADER_BAR_HEIGHT
      if (!model.hideHeaderOverview) {
        rubberbandControlTop += HEADER_OVERVIEW_HEIGHT
      }
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
          sticky={stickyViewHeaders}
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
        style={{
          top: rubberbandControlTop,
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
