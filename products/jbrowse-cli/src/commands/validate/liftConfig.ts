import type { SlotEntry } from './types.ts'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The member a bare string or number written in a sub-schema's place lifts
// into, by its `shorthand`.
function bareTarget({ shorthand = {} }: SlotEntry, value: unknown) {
  return typeof value === 'string'
    ? shorthand.string
    : typeof value === 'number'
      ? shorthand.number
      : undefined
}

function liftedBare(slot: SlotEntry, value: unknown) {
  const target = bareTarget(slot, value)
  return target === undefined ? value : { [target]: value }
}

function liftSlot(member: unknown, slot: SlotEntry): unknown {
  if (slot.subSlots) {
    const { subSlots, shorthand = {} } = slot
    if (Array.isArray(member) && shorthand.list !== undefined) {
      return liftToSnapshot({ [shorthand.list]: member }, subSlots)
    }
    const lift = (item: unknown) => {
      const target = bareTarget(slot, item)
      return liftToSnapshot(
        target === undefined ? item : { [target]: item },
        subSlots,
      )
    }
    return Array.isArray(member) ? member.map(lift) : lift(member)
  }
  const list =
    slot.liftsString && typeof member === 'string' ? [member] : member
  return slot.liftsNumbers && Array.isArray(list) ? list.map(String) : list
}

/**
 * A config object as its schema holds it once loaded, defaults still left off:
 * a bare string, number or list lifted into the sub-schema's `shorthand` slot
 * taking it or a string into a list of one, and a number in a list of strings
 * carried as a string. Which slot lifts
 * what is the manifest's record of the live schemas, so a rule list written
 * against a config snapshot reads a file the way it reads the app's.
 */
export function liftToSnapshot(value: unknown, slots: SlotEntry[]): unknown {
  return isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).map(([key, member]) => {
          const slot = slots.find(s => s.name === key)
          return [key, slot ? liftSlot(member, slot) : member]
        }),
      )
    : value
}

/**
 * Two settings bags as one, `over` written after `under` as the app folds
 * them (core's `mergeConfSettings`): a sub-schema writing its members one by
 * one merges member by member, a bare value its shorthand lifts included, and
 * any other slot or a channel takes `over`'s value whole. A key no slot
 * declares, a plugin's, merges as plain JSON. A value merged with nothing
 * keeps its written spelling.
 */
export function mergeBySlots(
  under: Record<string, unknown>,
  over: Record<string, unknown>,
  slots: SlotEntry[] = [],
): Record<string, unknown> {
  const out = { ...under }
  for (const [key, value] of Object.entries(over)) {
    const slot = slots.find(s => s.name === key)
    const members = !slot || (slot.subSlots && slot.writes === 'members')
    const prior = slot ? liftedBare(slot, out[key]) : out[key]
    const next = slot ? liftedBare(slot, value) : value
    out[key] =
      members && isRecord(prior) && isRecord(next)
        ? mergeBySlots(prior, next, slot?.subSlots)
        : value
  }
  return out
}
