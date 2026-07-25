import { useRef } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import RubberbandSpan from '../shared/RubberbandSpan.tsx'
import VerticalGuide from './VerticalGuide.tsx'
import { useRangeSelect } from './useRangeSelect.ts'

import type { MultiLevelRubberbandModel } from './types.ts'

const useStyles = makeStyles()({
  rubberbandControl: {
    cursor: 'crosshair',
    width: '100%',
    minHeight: 8,
    position: 'relative',
    zIndex: 900,
  },
})

const MultiLevelRubberband = observer(function MultiLevelRubberband({
  model,
  ControlComponent = <div />,
}: {
  model: MultiLevelRubberbandModel
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
          leftLabel={
            <PerLevelRows rows={leftBpOffset.map(l => stringify(l, true))} />
          }
          rightLabel={
            <PerLevelRows rows={rightBpOffset.map(r => stringify(r, true))} />
          }
          size={<PerLevelRows rows={numOfBpSelected.map(getBpDisplayStr)} />}
          width={width}
          left={left}
          viewWidth={Math.min(...model.views.map(view => view.width))}
          stickyTop={undefined}
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

// one row per rubberband level, in level order. values repeat across levels
// whenever the assemblies line up, so the index is the only stable key
function PerLevelRows({ rows }: { rows: string[] }) {
  return rows.map((row, idx) => (
    // eslint-disable-next-line @eslint-react/no-array-index-key
    <div key={idx}>{row}</div>
  ))
}

export default MultiLevelRubberband
