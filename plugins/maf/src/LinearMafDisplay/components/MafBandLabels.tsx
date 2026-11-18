import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getFillProps } from '@jbrowse/core/util'
import { BandChip, BandChipRow } from '@jbrowse/display-kit/BandChips'
import { GROUP_LABEL_INSET_X } from '@jbrowse/display-kit/groupLabelStyle'
import { leftAxisGutterWidth } from '@jbrowse/display-ui'
import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

// The export's title x, just clear of the Y-axis gutter the two bands share.
const LABEL_X = AXIS_GUTTER_WIDTH_PX + 2
const FONT_SIZE = 9
// SVG `<text>` is placed by its baseline, a line and a px under the band top.
const BASELINE_OFFSET = FONT_SIZE + 1

/**
 * The band titles for the SVG export, as plain text at the export's own x:
 * the export draws no controls, so neither the on-screen chips nor their x,
 * which follows the axes (`leftAxisGutterWidth`). `model.bandLabels` decides
 * what is titled.
 */
export function SvgMafBandLabels({
  labels,
}: {
  labels: { text: string; top: number }[]
}) {
  const palette = usePalette()
  return (
    <>
      {labels.map(({ text, top }) => (
        <text
          key={text}
          x={LABEL_X}
          y={top + BASELINE_OFFSET}
          fontSize={FONT_SIZE}
          {...getFillProps(palette.text.secondary)}
        >
          {text}
        </text>
      ))}
    </>
  )
}

/**
 * Each band's chip at its top-left, past the y-axis gutter the bands share,
 * whose × hides the band as its Show menu row does.
 */
const MafBandLabels = observer(function MafBandLabels({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const left = leftAxisGutterWidth(model.axes) + GROUP_LABEL_INSET_X
  return model.bandLabels.map(({ band, text, top }) => (
    <BandChipRow
      key={band}
      top={top + 1}
      left={left}
      testid={`band_chips_${band}`}
    >
      <BandChip
        label={text}
        onHide={() => {
          if (band === 'coverage') {
            model.setShowCoverage(false)
          } else {
            model.setShowConservation(false)
          }
        }}
      />
    </BandChipRow>
  ))
})

export default MafBandLabels
