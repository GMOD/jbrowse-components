import { LabeledCheckbox } from '@jbrowse/core/ui'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { TextField } from '@mui/material'

import { SCALE_MEMBERS, scaleMember, channelScale } from '../markEdit.ts'

import type { DraftMark, EditChannel, ScaleMember } from '../markEdit.ts'

/** A ramp is the one kind with ends to pin and stops to name. */
function isRamp(scale: string) {
  return scale === 'linear' || scale === 'log'
}

function memberLabel(member: ScaleMember) {
  return member === 'domainMin'
    ? 'min'
    : member === 'domainMax'
      ? 'max'
      : member
}

/**
 * The scale a channel's field is read through, beside the field itself: the
 * kind, and for a ramp the stops it samples and the ends that pin it. An end
 * left empty spans the loaded regions, so pinning both is what fixes a
 * figure's colours.
 *
 * `domain`, `range`, `labels` and `title` are not here: a list of values or
 * colours and a caption read better in the JSON box than in a row of boxes,
 * and a channel declaring one stays read-only in the picker above.
 */
export default function MarkScaleRow({
  mark,
  channel,
  scales,
  onScale,
  onMember,
}: {
  mark: DraftMark
  channel: EditChannel
  scales: readonly string[]
  onScale: (scale: string) => void
  onMember: (member: ScaleMember, value: string) => void
}) {
  const scale = channelScale(mark, channel)
  if (scale === '') {
    return null
  }
  const ramp = isRamp(scale)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <TextField
        select
        label="scale"
        value={scale}
        onChange={event => {
          onScale(event.target.value)
        }}
        slotProps={{
          select: { native: true },
          htmlInput: { 'data-testid': `scale-${channel}` },
        }}
      >
        {scales.map(name => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </TextField>
      {ramp ? (
        <TextField
          select
          label="scheme"
          value={scaleMember(mark, channel, 'scheme')}
          onChange={event => {
            onMember('scheme', event.target.value)
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': `scheme-${channel}` },
          }}
        >
          <option value="" />
          {COLOR_SCHEMES.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </TextField>
      ) : null}
      {ramp
        ? SCALE_MEMBERS.filter(
            member => member !== 'scheme' && member !== 'reverse',
          ).map(member => (
            <TextField
              key={member}
              type="number"
              label={memberLabel(member)}
              value={scaleMember(mark, channel, member)}
              onChange={event => {
                onMember(member, event.target.value)
              }}
              slotProps={{
                htmlInput: { 'data-testid': `${member}-${channel}` },
              }}
            />
          ))
        : null}
      {ramp ? (
        <LabeledCheckbox
          checked={scaleMember(mark, channel, 'reverse') === 'true'}
          onChange={next => {
            onMember('reverse', next ? 'true' : '')
          }}
          label="reverse"
        />
      ) : null}
    </div>
  )
}
