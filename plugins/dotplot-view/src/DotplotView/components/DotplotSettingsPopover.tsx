import { SingleSlider } from '@jbrowse/core/ui'
import {
  MIN_LENGTH_HELP,
  MinLengthSlider,
  OpacitySlider,
  SettingRow,
  SettingsPopover,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const DotplotSettingsPopover = observer(function DotplotSettingsPopover({
  model,
}: {
  model: DotplotViewModel
}) {
  const { alpha, lineWidth, minAlignmentLength } = model

  // Every row carries `help`, as the synteny popover's do — the shared
  // `SettingRow` reserves a column for it either way, so an unexplained row is a
  // blank slot beside explained ones rather than a tighter layout. The two
  // settings both views have say the same thing in each, deliberately.
  return (
    <SettingsPopover title="Dotplot display settings">
      <SettingRow
        label="Opacity:"
        help="Overall opacity of every plotted point. Lower values let dense overlapping alignments show through each other."
      >
        <OpacitySlider
          value={alpha}
          onChange={v => {
            model.setAlpha(v)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Line width:"
        help="Screen-space thickness of each alignment, in pixels. Sub-pixel alignments render as dots, so a wider line makes a sparse whole-genome plot legible; a narrower one keeps a dense one from filling in."
      >
        <SingleSlider
          value={lineWidth}
          onChange={v => {
            model.setLineWidth(v)
          }}
          min={0.5}
          max={10}
          step={0.5}
          valueLabelDisplay="auto"
          size="small"
        />
      </SettingRow>
      <SettingRow label="Min length:" help={MIN_LENGTH_HELP}>
        <MinLengthSlider
          value={minAlignmentLength}
          onCommit={bp => {
            model.setMinAlignmentLength(bp)
          }}
        />
      </SettingRow>
    </SettingsPopover>
  )
})

export default DotplotSettingsPopover
