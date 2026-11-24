import {
  BandChip,
  BandChipRow,
  bandChipsShown,
} from '@jbrowse/display-kit/BandChips'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { observer } from 'mobx-react'

import { bandChipLabel } from '../bandChips.ts'
import { bandScreenTop } from './sectionScreen.ts'

import type { BandChipKey, BandChipRow as Row } from '../bandChips.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'

function hideBand(model: LinearAlignmentsDisplayModel, key: BandChipKey) {
  if (key === 'coverage') {
    model.setShowCoverage(false)
  } else if (key === 'junctions') {
    model.setShowJunctions(false)
  } else if (key === 'readConnections') {
    model.setDrawnReadConnections('off')
  } else {
    model.setShowPileup(false)
  }
}

export const BandRowChips = observer(function BandRowChips({
  model,
  row,
}: {
  model: LinearAlignmentsDisplayModel
  row: Row
}) {
  return row.chips.map(key => (
    <BandChip
      key={key}
      label={bandChipLabel(key, model.readConnectionsMark)}
      onHide={() => {
        hideBand(model, key)
      }}
    />
  ))
})

/**
 * Each band's chip at its top-left, ahead of a left-side axis, which stands
 * past it (`valueScales`), but for the row the topmost section chip carries
 * (`GroupLabelsOverlay`). A row scrolling under that chip, which pins to the
 * canvas top, is not drawn.
 */
const BandChipsOverlay = observer(function BandChipsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { bandChips, scrollModel: scroll, showsGroupLabels } = model
  const minTop = showsGroupLabels ? GROUP_LABEL_HEIGHT + 1 : 0
  const rows = bandChipsShown(model) ? bandChips.rows : []
  return rows.map(row => {
    const top = bandScreenTop(row.top, scroll) + 1
    return top < minTop ||
      top + GROUP_LABEL_HEIGHT > scroll.canvasHeight ? null : (
      <BandChipRow key={row.band} top={top} testid={`band_chips_${row.band}`}>
        <BandRowChips model={model} row={row} />
      </BandChipRow>
    )
  })
})

export default BandChipsOverlay
