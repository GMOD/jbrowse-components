import { ContextMenu } from '@jbrowse/core/ui'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import RubberbandSpan from '../../shared/RubberbandSpan.tsx'
import { stickyChromeTops } from '../stickyChrome.ts'
import VerticalGuide from './VerticalGuide.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { useRangeSelect } from './useRangeSelect.ts'

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
  const { guideX, rubberband, anchorPosition, isClick, handleClose } = range

  return (
    <>
      {guideX !== undefined && !isScalebarRefNameMenuOpen ? (
        <VerticalGuide model={model} coordX={guideX} />
      ) : rubberband && !isClick ? (
        <RubberbandSpan
          left={rubberband.left}
          width={rubberband.width}
          viewWidth={model.width}
          stickyTop={scalebar}
          leftLabel={stringify(rubberband.leftBpOffset)}
          rightLabel={stringify(rubberband.rightBpOffset)}
          size={getBpDisplayStr(rubberband.numOfBpSelected)}
        />
      ) : null}
      <ContextMenu
        anchor={anchorPosition}
        offset={{ x: menuOffsetX, y: 0 }}
        onClose={handleClose}
        menuItems={() =>
          anchorPosition?.isClick
            ? model.rubberbandClickMenuItems(
                model.pxToBp(anchorPosition.offsetX),
              )
            : model.rubberBandMenuItems()
        }
      />
    </>
  )
})

export default RangeSelectOverlay
