import { MARK_SPECS } from './markSpecs.ts'
import { DEFAULT_MARK_TYPE } from './markVocabulary.ts'

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

// A channel object a picker can round-trip says a field and at most the scale
// that field implies, or a constant in `value` — the slot a shorthand lifts
// into. Anything else — a domain, a range, a scheme, a far foot's sequence —
// is the box's.
const PICKABLE_MEMBERS = new Set(['field', 'scale', 'value'])

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

/**
 * The mark with one channel written to `value`. A channel carrying its own
 * scale takes the one the field implies — a number reads through `linear` and
 * anything else through `categorical`, the rule Color by already follows — and
 * a value no scan saw is a constant, since that is what `color: "red"` and
 * `shape: "triangle-down"` are. An empty value clears the channel.
 */
export function withChannel(
  mark: DraftMark,
  channel: EditChannel,
  value: string,
  fields: PlotFields,
): DraftMark {
  const encoding = { ...mark.encoding }
  if (value === '') {
    delete encoding[channel]
  } else if (channel === 'color' || channel === 'shape') {
    const known =
      fields.numeric.includes(value) || fields.categorical.includes(value)
    Object.assign(encoding, {
      [channel]: known
        ? {
            field: value,
            scale: fields.numeric.includes(value) ? 'linear' : 'categorical',
          }
        : value,
    })
  } else {
    Object.assign(encoding, { [channel]: value })
  }
  return { ...mark, encoding }
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
