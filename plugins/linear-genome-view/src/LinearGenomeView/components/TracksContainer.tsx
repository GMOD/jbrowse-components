import { Suspense, lazy, useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines'
import Rubberband from './Rubberband'
import Scalebar from './Scalebar'
import VerticalGuide from './VerticalGuide'
import { SCALE_BAR_HEIGHT } from '../consts'
import { useRangeSelect } from './useRangeSelect'
import { useSideScroll } from './useSideScroll'
import { useWheelScroll } from './useWheelScroll'

import type { LinearGenomeViewModel } from '..'

const CenterLine = lazy(() => import('./CenterLine'))
const Highlight = lazy(() => import('./Highlight'))
const RubberbandSpan = lazy(() => import('./RubberbandSpan'))

const useStyles = makeStyles()({
  // Main container for all tracks
  // Sets --offset-px CSS variable so children can use calc() for positioning
  // instead of each observing offsetPx and recalculating in JS
  tracksContainer: {
    position: 'relative',
    contain: 'layout style',
  },
})

type LGV = LinearGenomeViewModel

const TracksContainer = observer(function TracksContainer({
  children,
  model,
}: {
  children: React.ReactNode
  model: LGV
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { mouseDown: mouseDown1, mouseUp } = useSideScroll(model)
  const { stickyViewHeaders, rubberbandTop, showGridlines, showCenterLine } =
    model
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
    open,
    isClick,
    clickBpOffset,
    handleMenuItemClick,
    handleClose,
    mouseMove,
    mouseDown: mouseDown2,
  } = useRangeSelect(ref, model, true)
  useWheelScroll(ref, model)

  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    undefined,
    { model },
  ) as React.ReactNode

  return (
    <div
      ref={ref}
      data-testid="tracksContainer"
      className={classes.tracksContainer}
      style={{ '--offset-px': `${model.offsetPx}px` } as React.CSSProperties}
      onMouseDown={event => {
        mouseDown1(event)
        mouseDown2(event)
      }}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
    >
      {showGridlines ? <Gridlines model={model} /> : null}
      <Suspense fallback={null}>
        {showCenterLine ? <CenterLine model={model} /> : null}
      </Suspense>
      {guideX !== undefined ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn ? (
        <Suspense fallback={null}>
          <RubberbandSpan
            leftBpOffset={leftBpOffset}
            rightBpOffset={rightBpOffset}
            numOfBpSelected={numOfBpSelected}
            width={width}
            left={left}
            top={rubberbandTop}
            sticky={stickyViewHeaders}
          />
        </Suspense>
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
          menuItems={
            isClick && clickBpOffset
              ? model.rubberbandClickMenuItems(clickBpOffset)
              : model.rubberBandMenuItems()
          }
        />
      ) : null}

      <Rubberband
        model={model}
        ControlComponent={
          <Scalebar
            model={model}
            style={{
              height: SCALE_BAR_HEIGHT,
              boxSizing: 'border-box',
            }}
          />
        }
      />
      <HighlightGroup model={model} />
      {additional}
      {children}
    </div>
  )
})

const HighlightGroup = observer(function HighlightGroup({
  model,
}: {
  model: LGV
}) {
  return model.highlight.length ? (
    <Suspense fallback={null}>
      {model.highlight.map((highlight, idx) => (
        <Highlight
          key={`${JSON.stringify(highlight)}-${idx}`}
          model={model}
          highlight={highlight}
        />
      ))}
    </Suspense>
  ) : null
})

export default TracksContainer
