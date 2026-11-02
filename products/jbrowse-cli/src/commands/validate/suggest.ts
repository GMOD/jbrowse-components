// "did you mean" for a mistyped identifier, shared by the validator and by
// add-track's up-front check on the settings it is about to write.

import type { Misnamed, SlotEntry } from './types.ts'

function editDistance(a: string, b: string) {
  // Two rolling rows rather than the full matrix; these are short identifiers
  // and this runs once per unknown key.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]!
}

// The nearest candidate, if it is near enough to be worth naming. The threshold
// scales with length so `uri` doesn't match every other three-letter slot while
// a longer typo still resolves.
export function suggest(
  word: string,
  candidates: string[],
  limit = Math.max(2, Math.floor(word.length / 3)),
) {
  let best: string | undefined
  let bestScore = Infinity
  for (const candidate of candidates) {
    const score = editDistance(word.toLowerCase(), candidate.toLowerCase())
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return bestScore <= limit ? best : undefined
}

export function didYouMean(word: string, candidates: string[]) {
  const hit = suggest(word, candidates)
  return hit ? ` — did you mean "${hit}"?` : ''
}

/** A dotted path as the nested objects a config writes: `rows: { step }`. */
export function nestedSpelling(path: string): string {
  const [head, ...rest] = path.split('.')
  return rest.length > 0
    ? `${head}: { ${nestedSpelling(rest.join('.'))} }`
    : `${head}`
}

/**
 * Whether the object declares the member path `members` (`rows`, `step`), so
 * a key writing it dotted, `"rows.step"`, means it but is one key, never a
 * path, and reads as nothing until written nested.
 */
export type DeclaresPath = (members: readonly string[]) => boolean

const declaresNoPath: DeclaresPath = () => false

function guessesOf(
  key: string,
  accepted: string[],
  misnamed: Misnamed,
  declaresPath: DeclaresPath,
) {
  const nearest = suggest(key, accepted)
  return Object.hasOwn(misnamed, key)
    ? [misnamed[key]!].flat()
    : key.includes('.') && declaresPath(key.split('.'))
      ? [nestedSpelling(key)]
      : nearest === undefined
        ? []
        : [nearest]
}

/**
 * What an unknown key most likely meant, quoted: each path the schema's
 * `misnamed` names for it, a dotted key's nested spelling where the object
 * declares that path, else the nearest accepted key.
 */
export function suggestKey(
  key: string,
  accepted: string[],
  misnamed: Misnamed = {},
  declaresPath = declaresNoPath,
) {
  const guesses = guessesOf(key, accepted, misnamed, declaresPath)
  return guesses.length > 0
    ? guesses.map(guess => `"${guess}"`).join(' or ')
    : undefined
}

export function didYouMeanKey(
  key: string,
  accepted: string[],
  misnamed: Misnamed = {},
  declaresPath = declaresNoPath,
) {
  const hit = suggestKey(key, accepted, misnamed, declaresPath)
  return hit ? ` — did you mean ${hit}?` : ''
}

/** Whether `members` walks the manifest's sub-slots to a slot each declares. */
export function slotsDeclarePath(
  slots: readonly SlotEntry[],
  members: readonly string[],
): boolean {
  const [head, ...rest] = members
  const slot = slots.find(s => s.name === head)
  return (
    slot !== undefined &&
    (rest.length === 0 ||
      (slot.subSlots !== undefined && slotsDeclarePath(slot.subSlots, rest)))
  )
}
