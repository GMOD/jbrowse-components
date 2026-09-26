import { isCssColor } from '@jbrowse/core/util/cssColorParse'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { SHAPE_NAMES } from '@jbrowse/core/util/shapeNames'
import { COLOR_SCALES } from '@jbrowse/display-kit/colorScale'

import { MARK_SPECS } from './markSpecs.ts'
import { DEFAULT_MARK_TYPE, SIZE_SCALES } from './markVocabulary.ts'

import type { MarkSnapshot } from './markProblems.ts'
import type { MarkChannel } from './markSpecs.ts'
import type { MarkType } from './markVocabulary.ts'
import type { PlotFields } from './scanPlotFields.ts'

/** A channel a control edits: the two positional ones, and the type's own. */
export type EditChannel = 'x' | 'x2' | MarkChannel

/**
 * A mark as a draft holds it. Only `encoding` differs from {@link
 * MarkSnapshot}, and it has to: that type is the shape the schema answers
 * with, where a constant colour has already lifted to `{ value: 'red' }`,
 * while a form writes the spelling a config file writes.
 */
export interface DraftMark extends Omit<MarkSnapshot, 'encoding'> {
  encoding?: Record<string, unknown>
}

const POSITIONAL: EditChannel[] = ['x', 'x2']

/** Which channels a mark of this type reads, in the order a form shows them. */
export function editChannels(type: MarkType): EditChannel[] {
  return [...MARK_SPECS[type].channels, ...POSITIONAL]
}

export function markTypeOf(mark: DraftMark): MarkType {
  return mark.mark ?? DEFAULT_MARK_TYPE
}

/** What a control shows for one channel, and whether it may write it back. */
export interface ChannelEdit {
  /** The field or constant the picker holds; empty where the channel is unset. */
  value: string
  /**
   * The declaration says more than a field picker can, so the control is
   * read-only and the JSON box is where it is edited. A form that wrote here
   * would drop the members it never showed, which is the whole failure the
   * editor exists to stop.
   */
  beyond: boolean
}

const UNSET: ChannelEdit = { value: '', beyond: false }

/**
 * The scale members a control shows beside a channel's field: the kind it
 * reads through, and for a ramp the ends that pin it and the named stops it
 * samples. `domain`, `range`, `labels`, `title` and `domainMid` are lists and
 * captions, which the JSON box holds better than a row of boxes would.
 */
export const SCALE_MEMBERS = [
  'scheme',
  'reverse',
  'domainMin',
  'domainMax',
] as const
export type ScaleMember = (typeof SCALE_MEMBERS)[number]

/** The ends a ramp is pinned by, which a width ramp shares with a colour one. */
export const RAMP_ENDS = ['domainMin', 'domainMax'] as const

export function isRamp(scale: unknown) {
  return scale === 'linear' || scale === 'log'
}

/** The members a ramp of this channel paints: a colour's stops, and the ends. */
function rampMembers(channel: EditChannel): readonly ScaleMember[] {
  return channel === 'color' ? SCALE_MEMBERS : RAMP_ENDS
}

/**
 * The scale kinds a channel offers, off the vocabulary its own schema
 * declares: every colour scale for `color`, `categorical` alone for `shape`,
 * and a width's two ramps for `size`. `none` is the constant, which the field
 * picker above already means.
 */
export function channelScales(channel: EditChannel): readonly string[] {
  return channel === 'color'
    ? COLOR_SCALES.filter(scale => scale !== 'none')
    : channel === 'shape'
      ? ['categorical']
      : channel === 'size'
        ? SIZE_SCALES
        : []
}

// A channel object a picker can round-trip: a field, the scale it reads
// through, the ramp members above, or a constant in `value` — the slot a
// shorthand lifts into. Anything else is the box's.
const PICKABLE_MEMBERS = new Set<string>([
  'field',
  'scale',
  'value',
  ...SCALE_MEMBERS,
])

function pickedValue(declared: Record<string, unknown>) {
  const { field, value } = declared
  return typeof field === 'string' && field !== ''
    ? field
    : typeof value === 'string'
      ? value
      : ''
}

function editOf(declared: unknown): ChannelEdit {
  if (declared === undefined) {
    return UNSET
  }
  if (typeof declared === 'string') {
    return { value: declared, beyond: false }
  }
  if (typeof declared !== 'object' || declared === null) {
    return { value: '', beyond: true }
  }
  const members = declared as Record<string, unknown>
  const beyond = Object.entries(members).some(
    ([key, value]) => !PICKABLE_MEMBERS.has(key) && value !== undefined,
  )
  return { value: beyond ? '' : pickedValue(members), beyond }
}

export function channelEdit(
  mark: DraftMark,
  channel: EditChannel,
): ChannelEdit {
  return editOf(mark.encoding?.[channel])
}

function objectOf(declared: unknown) {
  return typeof declared === 'object' && declared !== null
    ? (declared as Record<string, unknown>)
    : undefined
}

function channelObject(mark: DraftMark, channel: EditChannel) {
  return objectOf(mark.encoding?.[channel])
}

/** The scale a channel's field reads through where the declaration names none. */
const PRESET_SCALES: Partial<Record<EditChannel, string>> = {
  color: 'categorical',
  shape: 'categorical',
  size: 'linear',
}

/**
 * The field a channel reads: an object's `field`, or the string shorthand of a
 * `size`, which lifts into `field`. A colour's or a shape's string is the
 * constant.
 */
function channelField(mark: DraftMark, channel: EditChannel): string {
  const declared = mark.encoding?.[channel]
  const field =
    typeof declared === 'string'
      ? channel === 'size'
        ? declared
        : ''
      : objectOf(declared)?.field
  return typeof field === 'string' ? field : ''
}

/**
 * The scale a channel reads its field through, as its control shows it. Empty
 * where the channel names no field, since a constant reads through none.
 */
export function channelScale(mark: DraftMark, channel: EditChannel): string {
  if (channelEdit(mark, channel).beyond || !channelField(mark, channel)) {
    return ''
  }
  const scale = channelObject(mark, channel)?.scale
  return typeof scale === 'string' ? scale : (PRESET_SCALES[channel] ?? '')
}

/** What one scale member says, as a control holds it: text, never a number. */
export function scaleMember(
  mark: DraftMark,
  channel: EditChannel,
  member: ScaleMember,
): string {
  const held = channelObject(mark, channel)?.[member]
  return held === undefined || held === false ? '' : String(held)
}

function writeChannel(
  mark: DraftMark,
  channel: EditChannel,
  members: Record<string, unknown>,
): DraftMark {
  const kept = Object.fromEntries(
    Object.entries(members).filter(([, value]) => value !== undefined),
  )
  return { ...mark, encoding: { ...mark.encoding, [channel]: kept } }
}

/**
 * The mark with a channel read through another scale. A field is required —
 * a constant reads through no scale — and the members the new kind does not
 * paint are dropped, which the rule list would otherwise report as unread.
 */
export function withChannelScale(
  mark: DraftMark,
  channel: EditChannel,
  scale: string,
): DraftMark {
  const declared = channelObject(mark, channel) ?? {}
  const kept = isRamp(scale) ? rampMembers(channel) : []
  return writeChannel(mark, channel, {
    field: channelField(mark, channel) || undefined,
    scale,
    ...Object.fromEntries(kept.map(member => [member, declared[member]])),
  })
}

/**
 * The mark with one scale member written. An empty value clears it, so a
 * cleared end autoscales over the loaded regions again.
 */
export function withScaleMember(
  mark: DraftMark,
  channel: EditChannel,
  member: ScaleMember,
  value: string,
): DraftMark {
  const held =
    value === ''
      ? undefined
      : member === 'reverse'
        ? value === 'true'
        : member === 'scheme'
          ? value
          : Number(value)
  return writeChannel(mark, channel, {
    ...channelObject(mark, channel),
    [member]: held,
  })
}

function readsNumbers(scale: unknown) {
  return isRamp(scale) || scale === 'threshold'
}

/**
 * Whether a colour or shape value is the constant its shorthand spells: a CSS
 * colour or a shape name, or a `jexl:` callback — except over a field, where a
 * `jexl:` is the field's own expression.
 */
function spellsConstant(
  channel: 'color' | 'shape',
  value: string,
  overField: boolean,
) {
  return isJexl(value)
    ? !overField
    : channel === 'color'
      ? isCssColor(value)
      : (SHAPE_NAMES as readonly string[]).includes(value)
}

/**
 * The mark with one channel written to `value`, an empty one clearing it.
 *
 * A colour or shape value is a field unless it spells a constant, and a field
 * the scan found is a field whatever it spells. A field edit keeps the scale
 * it is read through and that scale's members; only a field the scan types
 * the other way — a number under `categorical`, text under a ramp — takes the
 * scale it implies, the rule Color by follows.
 *
 * `base` is the channel as declared before the edit began, so a value typed
 * through a constant on its way to a field (`red` on the way to `reads`) keeps
 * what the channel held.
 */
export function withChannel(
  mark: DraftMark,
  channel: EditChannel,
  value: string,
  fields: PlotFields,
  base: unknown = mark.encoding?.[channel],
): DraftMark {
  if (value === '') {
    return withoutChannel(mark, channel)
  }
  const held = objectOf(base)
  const implied = fields.numeric.includes(value)
    ? 'linear'
    : fields.categorical.includes(value)
      ? 'categorical'
      : undefined
  if (channel === 'color' || channel === 'shape') {
    const heldField = typeof held?.field === 'string' && held.field !== ''
    if (implied === undefined && spellsConstant(channel, value, heldField)) {
      return { ...mark, encoding: { ...mark.encoding, [channel]: value } }
    }
    if (channel === 'shape') {
      return writeChannel(mark, channel, {
        ...held,
        field: value,
        scale: 'categorical',
      })
    }
    const heldScale = heldField ? held.scale : 'none'
    return heldScale !== 'none' &&
      (implied === undefined ||
        readsNumbers(implied) === readsNumbers(heldScale))
      ? writeChannel(mark, channel, { ...held, field: value })
      : writeChannel(mark, channel, {
          value: held?.value,
          field: value,
          scale: implied ?? 'categorical',
        })
  }
  return channel === 'size' && held
    ? writeChannel(mark, channel, { ...held, field: value })
    : { ...mark, encoding: { ...mark.encoding, [channel]: value } }
}

/**
 * Channels the mark writes that its type does not read — a `y` left behind
 * when a bar became a span. The form shows them rather than dropping them, and
 * `unread-channel` is what the rule list says about each.
 */
export function unreadChannels(mark: DraftMark): EditChannel[] {
  const read = new Set<string>(editChannels(markTypeOf(mark)))
  return Object.keys(mark.encoding ?? {}).filter(
    (channel): channel is EditChannel =>
      !read.has(channel) &&
      channelEdit(mark, channel as EditChannel).value !== '',
  )
}

export function withoutChannel(
  mark: DraftMark,
  channel: EditChannel,
): DraftMark {
  const encoding = { ...mark.encoding }
  delete encoding[channel]
  return { ...mark, encoding }
}

/** A mark's type changed, keeping every channel so nothing is lost silently. */
export function withMarkType(mark: DraftMark, type: MarkType): DraftMark {
  return { ...mark, mark: type }
}

/**
 * The marks of a plot, as a form holds them. A plot is whatever the user
 * typed, so this is the one place deciding what counts as a mark list, and
 * anything else reads as none rather than as a broken form.
 */
export function draftMarks(plot: { marks?: unknown }): DraftMark[] {
  return Array.isArray(plot.marks)
    ? plot.marks.filter(
        (mark): mark is DraftMark => typeof mark === 'object' && mark !== null,
      )
    : []
}

export function addMark(marks: readonly DraftMark[]): DraftMark[] {
  return [...marks, {}]
}

export function removeMark(marks: readonly DraftMark[], at: number) {
  return marks.toSpliced(at, 1)
}

/** One mark moved by `by` places, doing nothing at either end. */
export function moveMark(
  marks: readonly DraftMark[],
  at: number,
  by: number,
): DraftMark[] {
  const to = at + by
  if (to < 0 || to >= marks.length) {
    return [...marks]
  }
  const lo = Math.min(at, to)
  return marks.toSpliced(lo, 2, marks[lo + 1]!, marks[lo]!)
}

/** The line a list row carries: the mark's type, then what it reads. */
export function markSummary(mark: DraftMark): string {
  const type = markTypeOf(mark)
  const reads = editChannels(type)
    .filter(channel => channel !== 'x' && channel !== 'x2')
    .flatMap(channel => {
      const { value, beyond } = channelEdit(mark, channel)
      return beyond ? [channel] : value ? [`${channel} ${value}`] : []
    })
  return [type, ...reads].join(' · ')
}
