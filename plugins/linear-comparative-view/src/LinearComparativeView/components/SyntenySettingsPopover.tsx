import { SingleSlider } from '@jbrowse/core/ui'
import {
  MIN_LENGTH_HELP,
  MinLengthSlider,
  OpacitySlider,
  PAN_BUFFER_PX,
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
      <SettingRow label="Min length:" help={MIN_LENGTH_HELP}>
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
        {/*
          Capped at the pan buffer, which is what the worker emits out to
          (syntenyPanBufferPx: this floor, or half the viewport on a wide view).
          Past it there is no CIGAR detail and there are no location markers,
          because the geometry stage culled them — so the slider used to offer
          5x more overdraw than there was anything to draw, and spending it
          bought ribbons whose ticks stopped partway along. The floor rather
          than the width-scaled value so this holds at every viewport size
          without plumbing the width in; a wide view leaves a little on the
          table, and overdraw beyond one screen is already past what panning
          reveals before the fetch window rolls over.
        */}
        <SingleSlider
          value={overdrawPx}
          onChange={val => {
            model.setOverdrawPx(val)
          }}
          min={0}
          max={PAN_BUFFER_PX}
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
          ariaLabel="Identity fade"
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
          ariaLabel="Thin fade"
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
