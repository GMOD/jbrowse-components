import { unwrapType } from '@jbrowse/mobx-state-tree'

import { isPlainObject } from '../util/objectUtils.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

const mergeMembers = new WeakMap<IAnyType, string>()

/**
 * #api core/configuration
 * Declares that a settings bag or a plot draft writing a list of this type
 * merges with the list it lands on by one member of each entry, as a `filter`
 * list merges by `field`: the written entries replace the entries naming the
 * same value there, in place, and every other entry stays. A bare entry,
 * the shorthand naming that member, keys as itself. `null` still resets the
 * list, and the "Edit plot..." text (`{ whole: true }`) still writes it whole.
 */
export function listMergedBy<T extends IAnyType>(type: T, member: string): T {
  mergeMembers.set(unwrapType(type), member)
  return type
}

/** The member a list type merges by, if it declares one. */
export function mergedListMember(type: IAnyType) {
  return mergeMembers.get(unwrapType(type))
}

/** `next` written over `prior`, by `member`: see {@link listMergedBy}. */
export function mergeListBy(
  prior: readonly unknown[],
  next: readonly unknown[],
  member: string,
) {
  const keyOf = (entry: unknown) =>
    isPlainObject(entry) ? entry[member] : entry
  const written = new Map<unknown, unknown[]>()
  for (const entry of next) {
    const key = keyOf(entry)
    written.set(key, [...(written.get(key) ?? []), entry])
  }
  const placed = new Set<unknown>()
  const out: unknown[] = []
  for (const entry of prior) {
    const key = keyOf(entry)
    const replacing = written.get(key)
    if (!replacing) {
      out.push(entry)
    } else if (!placed.has(key)) {
      out.push(...replacing)
      placed.add(key)
    }
  }
  for (const [key, entries] of written) {
    if (!placed.has(key)) {
      out.push(...entries)
    }
  }
  return out
}
