import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { COLOR_SCHEMES } from '@jbrowse/core/util/colorSchemes'
import { RAMP_AUTOSCALES } from '@jbrowse/core/util/rampExtent'
import { TextField } from '@mui/material'

import {
  RAMP_ENDS,
  channelScale,
  isRamp,
  listMember,
  scaleMember,
} from '../markEdit.ts'

import type {
  DraftMark,
  EditChannel,
  ListMember,
  ScaleMember,
} from '../markEdit.ts'

const MEMBER_LABELS: Partial<Record<ScaleMember, string>> = {
  domainMin: 'min',
  domainMax: 'max',
  domainMid: 'middle',
  numQuantile: 'percentile',
  title: 'key title',
}

// What each list is, in the words of the scale it belongs to.
function listLabel(channel: EditChannel, scale: string, member: ListMember) {
  if (member === 'labels') {
    return scale === 'threshold' ? 'interval names' : 'key names'
  }
  if (member === 'domain') {
    return scale === 'threshold' ? 'cut points' : 'values, in order'
  }
  return channel === 'shape'
    ? 'shapes'
    : channel === 'size'
      ? 'px at low, high'
      : 'colours'
}

// Which lists a scale reads: a categorical or threshold colour its values or
// cuts, their colours and their names; a shape its values and shapes; a width
// ramp its two px ends; a colour ramp its stops.
function listsOf(channel: EditChannel, scale: string): ListMember[] {
  if (channel === 'size') {
    return ['range']
  }
  if (isRamp(scale)) {
    return channel === 'color' ? ['range'] : []
  }
  return channel === 'color'
    ? ['domain', 'range', 'labels']
    : ['domain', 'range']
}

function MemberField({
  mark,
  channel,
  member,
  type = 'text',
  onMember,
}: {
  mark: DraftMark
  channel: EditChannel
  member: ScaleMember
  type?: 'text' | 'number'
  onMember: (member: ScaleMember, value: string) => void
}) {
  return (
    <TextField
      type={type}
      label={MEMBER_LABELS[member] ?? member}
      value={scaleMember(mark, channel, member)}
      onChange={event => {
        onMember(member, event.target.value)
      }}
      slotProps={{ htmlInput: { 'data-testid': `${member}-${channel}` } }}
    />
  )
}

// Holds the text as typed, so a trailing comma survives until the next item,
// and writes the list it parses on every keystroke.
function ListField({
  label,
  initial,
  testId,
  onList,
}: {
  label: string
  initial: string
  testId: string
  onList: (text: string) => void
}) {
  const [text, setText] = useState(initial)
  return (
    <TextField
      label={label}
      value={text}
      onChange={event => {
        setText(event.target.value)
        onList(event.target.value)
      }}
      slotProps={{ htmlInput: { 'data-testid': testId } }}
    />
  )
}

/**
 * The scale a channel's field is read through, beside the field itself: the
 * kind; for a categorical or threshold scale its values or cut points, their
 * colours and their names in the key; for a ramp the stops it samples, the
 * ends that pin it, its middle and how an open end follows the data; and the
 * key's title. A list is comma-separated text, and emptying one returns it to
 * the display's default.
 */
export default function MarkScaleRow({
  mark,
  channel,
  scales,
  onScale,
  onMember,
  onList,
}: {
  mark: DraftMark
  channel: EditChannel
  scales: readonly string[]
  onScale: (scale: string) => void
  onMember: (member: ScaleMember, value: string) => void
  onList: (member: ListMember, text: string) => void
}) {
  const scale = channelScale(mark, channel)
  if (scale === '') {
    return null
  }
  const ramp = isRamp(scale)
  const colorRamp = ramp && channel === 'color'
  const percentile =
    colorRamp && scaleMember(mark, channel, 'autoscale') === 'localpercentile'
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
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
      {colorRamp ? (
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
        ? RAMP_ENDS.map(member => (
            <MemberField
              key={member}
              mark={mark}
              channel={channel}
              member={member}
              type="number"
              onMember={onMember}
            />
          ))
        : null}
      {colorRamp ? (
        <>
          <MemberField
            mark={mark}
            channel={channel}
            member="domainMid"
            type="number"
            onMember={onMember}
          />
          <TextField
            select
            label="open ends follow"
            value={scaleMember(mark, channel, 'autoscale') || 'local'}
            onChange={event => {
              onMember(
                'autoscale',
                event.target.value === 'local' ? '' : event.target.value,
              )
            }}
            slotProps={{
              select: { native: true },
              htmlInput: { 'data-testid': `autoscale-${channel}` },
            }}
          >
            {RAMP_AUTOSCALES.map(name => (
              <option key={name} value={name}>
                {name === 'local' ? 'the extremes' : 'a percentile'}
              </option>
            ))}
          </TextField>
          {percentile ? (
            <MemberField
              mark={mark}
              channel={channel}
              member="numQuantile"
              type="number"
              onMember={onMember}
            />
          ) : null}
          <LabeledCheckbox
            checked={scaleMember(mark, channel, 'reverse') === 'true'}
            onChange={next => {
              onMember('reverse', next ? 'true' : '')
            }}
            label="reverse"
          />
        </>
      ) : null}
      {listsOf(channel, scale).map(member => (
        <ListField
          key={`${scale}-${member}`}
          label={listLabel(channel, scale, member)}
          initial={listMember(mark, channel, member)}
          testId={`${member}-${channel}`}
          onList={text => {
            onList(member, text)
          }}
        />
      ))}
      {channel === 'color' ? (
        <MemberField
          mark={mark}
          channel={channel}
          member="title"
          onMember={onMember}
        />
      ) : null}
    </div>
  )
}
