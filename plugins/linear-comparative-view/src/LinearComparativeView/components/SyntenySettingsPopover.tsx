import { SingleSlider } from '@jbrowse/core/ui'
import {
  MinLengthSlider,
  OpacitySlider,
  SettingRow,
  SettingsPopover,
  SliderTooltip,
} from '@jbrowse/synteny-core'
import HelpIcon from '@mui/icons-material/Help'
import { Checkbox, FormControlLabel, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const SyntenySettingsPopover = observer(function SyntenySettingsPopover({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { alpha, minAlignmentLength, opacityByIdentity, overdrawPx } = model
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
            slots={{ valueLabel: SliderTooltip }}
          />
        </SettingRow>
        <FormControlLabel
          control={
            <Checkbox
              checked={opacityByIdentity}
              onChange={() => {
                model.setOpacityByIdentity(!opacityByIdentity)
              }}
              size="small"
            />
          }
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Typography variant="body2">Fade by identity</Typography>
              <Tooltip
                title="Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel."
                arrow
              >
                <HelpIcon sx={{ fontSize: '0.875rem', ml: 0.5 }} />
              </Tooltip>
            </span>
          }
        />
      </div>
    </SettingsPopover>
  )
})

export default SyntenySettingsPopover
