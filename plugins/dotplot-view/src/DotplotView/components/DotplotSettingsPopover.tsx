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
  const { alpha, lineWidth, minAlignmentLength } = model

  return (
    <SettingsPopover title="Dotplot display settings">
      <SettingRow label="Opacity:">
        <OpacitySlider
          value={alpha}
          onChange={v => {
            model.setAlpha(v)
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
            model.setMinAlignmentLength(bp)
          }}
        />
      </SettingRow>
    </SettingsPopover>
  )
})

export default DotplotSettingsPopover
