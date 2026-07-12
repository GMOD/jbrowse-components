import { SingleSlider } from '@jbrowse/core/ui'
import {
  MinLengthSlider,
  OpacitySlider,
  SettingCheckbox,
  SettingRow,
  SettingsPopover,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const SyntenySettingsPopover = observer(function SyntenySettingsPopover({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const {
    alpha,
    fadeThinAlignments,
    minAlignmentLength,
    opacityByIdentity,
    overdrawPx,
  } = model
  return (
    <SettingsPopover title="Synteny display settings">
      <div
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: 250,
        }}
      >
        <SettingRow label="Opacity:">
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
        <SettingCheckbox
          label="Fade by identity"
          help="Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel."
          checked={opacityByIdentity}
          onChange={() => {
            model.setOpacityByIdentity(!opacityByIdentity)
          }}
        />
        <SettingCheckbox
          label="Fade thin alignments"
          help="Fades sub-pixel-thin ribbons by their on-screen width, so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. Turn off for a genuinely sparse comparison (e.g. distant species) where every real alignment is sub-pixel and the fade would wash the view out instead of decluttering it."
          checked={fadeThinAlignments}
          onChange={() => {
            model.setFadeThinAlignments(!fadeThinAlignments)
          }}
        />
      </div>
    </SettingsPopover>
  )
})

export default SyntenySettingsPopover
