import { SingleSlider } from '@jbrowse/core/ui'
import {
  MinLengthSlider,
  OpacitySlider,
  SettingRow,
  SettingToggleGroup,
  SettingsPopover,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const FADE_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

const ON_OFF = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

const SyntenySettingsPopover = observer(function SyntenySettingsPopover({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const {
    alpha,
    fadeThinAlignmentsMode,
    minAlignmentLength,
    opacityByIdentity,
    overdrawPx,
  } = model
  return (
    <SettingsPopover title="Synteny display settings">
      <SettingRow
        label="Opacity:"
        help="Overall opacity of all synteny ribbons. Lower values let dense overlapping alignments show through each other."
      >
        <OpacitySlider
          value={alpha}
          onChange={v => {
            model.setAlpha(v)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Min length:"
        help="Hides alignments shorter than this many bp. Cuts whole-genome hairball noise from short/spurious chains."
      >
        <MinLengthSlider
          value={minAlignmentLength}
          onCommit={bp => {
            model.setMinAlignmentLength(bp)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Overdraw:"
        help="Extra pixels drawn beyond the visible area. Higher values keep off-screen synteny lines visible when scrolling, but may reduce performance."
      >
        <SingleSlider
          value={overdrawPx}
          onChange={val => {
            model.setOverdrawPx(val)
          }}
          min={0}
          max={10000}
          step={100}
          valueLabelDisplay="auto"
          size="small"
          valueLabelFormat={(val: number) => `${val}px`}
        />
      </SettingRow>
      <SettingRow
        label="Identity fade:"
        help="Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel."
      >
        <SettingToggleGroup
          value={opacityByIdentity ? 'on' : 'off'}
          options={ON_OFF}
          onChange={v => {
            model.setOpacityByIdentity(v === 'on')
          }}
        />
      </SettingRow>
      <SettingRow
        label="Thin fade:"
        help="Fades sub-pixel-thin ribbons by their on-screen width, so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. Auto enables it only when the view is dense enough to tangle; a genuinely sparse comparison (e.g. distant species, every alignment sub-pixel) stays unfaded so the fade doesn't wash it out. On/Off pin it."
      >
        <SettingToggleGroup
          value={fadeThinAlignmentsMode}
          options={FADE_MODES}
          onChange={v => {
            model.setFadeThinAlignmentsMode(v)
          }}
        />
      </SettingRow>
    </SettingsPopover>
  )
})

export default SyntenySettingsPopover
