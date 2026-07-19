import { SingleSlider } from '@jbrowse/core/ui'
import {
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
  const { dotplotDisplays, lineWidth } = model
  const firstDisplay = dotplotDisplays[0]
  const alpha = firstDisplay?.alpha ?? 1
  const minAlignmentLength = firstDisplay?.minAlignmentLength ?? 0

  return (
    <SettingsPopover title="Dotplot display settings">
      <SettingRow label="Opacity:">
        <OpacitySlider
          value={alpha}
          onChange={v => {
            for (const d of dotplotDisplays) {
              d.setAlpha(v)
            }
          }}
        />
      </SettingRow>
      <SettingRow label="Line width:">
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
      <SettingRow label="Min length:">
        <MinLengthSlider
          value={minAlignmentLength}
          onCommit={bp => {
            for (const d of dotplotDisplays) {
              d.setMinAlignmentLength(bp)
            }
          }}
        />
      </SettingRow>
    </SettingsPopover>
  )
})

export default DotplotSettingsPopover
