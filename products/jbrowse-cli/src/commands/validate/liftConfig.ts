import type { SlotEntry } from './types.ts'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function liftSlot(member: unknown, slot: SlotEntry): unknown {
  if (slot.subSlots) {
    const { subSlots, shorthand } = slot
    const lift = (item: unknown) =>
      liftToSnapshot(
        typeof item === 'string' && shorthand !== undefined
          ? { [shorthand]: item }
          : item,
        subSlots,
      )
    return Array.isArray(member) ? member.map(lift) : lift(member)
  }
  const list =
    slot.liftsString && typeof member === 'string' ? [member] : member
  return slot.liftsNumbers && Array.isArray(list) ? list.map(String) : list
}

/**
 * A config object as its schema holds it once loaded, defaults still left off:
 * a bare string lifted into a sub-schema's `shorthand` slot or into a list of
 * one, and a number in a list of strings carried as a string. Which slot lifts
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
