import { Suspense, lazy } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { stickyChromeTops } from '../stickyChrome.ts'
import VerticalGuide from './VerticalGuide.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { useRangeSelect } from './useRangeSelect.ts'

const RubberbandSpan = lazy(() => import('../../shared/RubberbandSpan.tsx'))

type LGV = LinearGenomeViewModel

const RangeSelectOverlay = observer(function RangeSelectOverlay({
  model,
  range,
  menuOffsetX = 0,
}: {
  model: LGV
  range: ReturnType<typeof useRangeSelect>
  menuOffsetX?: number
}) {
  const { stickyViewHeaders, headerHeight, isScalebarRefNameMenuOpen } = model
  const { scalebar } = stickyChromeTops({ stickyViewHeaders, headerHeight })
  const {
    guideX,
    rubberbandOn,
    rubberband,
    anchorPosition,
    open,
    isClick,
    clickBpOffset,
    handleMenuItemClick,
    handleClose,
  } = range

  return (
    <>
      {guideX !== undefined && !isScalebarRefNameMenuOpen ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberbandOn && rubberband ? (
        <Suspense fallback={null}>
          <RubberbandSpan
            left={rubberband.left}
            width={rubberband.width}
            viewWidth={model.width}
            stickyTop={scalebar}
            leftLabel={stringify(rubberband.leftBpOffset)}
            rightLabel={stringify(rubberband.rightBpOffset)}
            size={getBpDisplayStr(rubberband.numOfBpSelected)}
          />
        </Suspense>
      ) : null}
      {anchorPosition ? (
        <Menu
          anchorReference="anchorPosition"
          anchorPosition={{
            left: anchorPosition.clientX + menuOffsetX,
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
    </>
  )
})

export default RangeSelectOverlay
