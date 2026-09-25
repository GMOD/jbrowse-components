const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function scalar(text: string): string | number | boolean {
  if (text === 'true' || text === 'false') {
    return text === 'true'
  }
  const n = Number(text)
  return text.trim() !== '' && Number.isFinite(n) ? n : text
}

const LOCATION_SO_FAR = /^[^\s,:]+:[\d,-]*\d$/

// The comma at `i` groups a location's digits, as the app writes one:
// `chr2:135,787,850-135,876,467`.
function groupsDigits(text: string, start: number, i: number) {
  return (
    LOCATION_SO_FAR.test(text.slice(start, i)) &&
    /^\d{3}(?!\d)/.test(text.slice(i + 1))
  )
}

// A `jexl:` item runs to the first comma outside its own brackets and quotes,
// since a jexl call separates its arguments with commas, and a location keeps
// the commas grouping its digits.
function listItems(text: string) {
  const items: string[] = []
  let start = 0
  let depth = 0
  let quote: string | undefined
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i)
    if (quote) {
      if (c === '\\') {
        i++
      } else if (c === quote) {
        quote = undefined
      }
    } else if (c === ',' && depth === 0 && !groupsDigits(text, start, i)) {
      items.push(text.slice(start, i))
      start = i + 1
    } else if (text.startsWith('jexl:', start)) {
      if (c === "'" || c === '"') {
        quote = c
      } else if ('([{'.includes(c)) {
        depth++
      } else if (')]}'.includes(c)) {
        depth--
      }
    }
  }
  items.push(text.slice(start))
  return items
}

/**
 * The value of a `path=value` modifier: `true`/`false`, a number, a
 * comma-separated list (a trailing comma makes a list of one, and a `jexl:`
 * item keeps the commas inside its own brackets and quotes), or the text as
 * written.
 */
export function slotValue(text: string) {
  const items = listItems(text)
  return items.length > 1
    ? items.filter(item => item !== '').map(scalar)
    : scalar(text)
}

/** Whether a track option is a `path=value` slot write rather than a named modifier. */
export function isSlotPathOption(opt: string) {
  return /^[A-Za-z_][\w.]*=/.test(opt)
}

/**
 * Whether a slot write names a member of a setting, `color.field=…`, rather
 * than a whole setting, `height=…`.
 */
export function isMemberWrite(opt: string) {
  return isSlotPathOption(opt) && opt.slice(0, opt.indexOf('=')).includes('.')
}

/**
 * Merge `patch` into `target`, object into object and anything else replacing
 * what was there, so `color.field=…` and `color.range=…` fill one object in
 * either order.
 */
export function mergeSettings(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(patch)) {
    if (UNSAFE_SEGMENTS.has(key)) {
      throw new Error(`Invalid track option key "${key}"`)
    }
    const existing = target[key]
    if (isPlainObject(value) && isPlainObject(existing)) {
      mergeSettings(existing, value)
    } else {
      target[key] = isPlainObject(value) ? mergeSettings({}, value) : value
    }
  }
  return target
}

/** A `path=value` modifier read apart: the segments it walks, and what it sets. */
export interface SlotWrite {
  opt: string
  segments: string[]
  value: unknown
}

/** `color.range=tan,teal` and `marks.0.encoding.y=score`, read apart. */
export function slotWrite(opt: string): SlotWrite {
  const eq = opt.indexOf('=')
  const segments = opt.slice(0, eq).split('.')
  if (segments.includes('')) {
    throw new Error(`Invalid track option "${opt}": an empty path segment`)
  }
  for (const segment of segments) {
    if (UNSAFE_SEGMENTS.has(segment)) {
      throw new Error(`Invalid track option key "${segment}"`)
    }
  }
  return { opt, segments, value: slotValue(opt.slice(eq + 1)) }
}

// A segment of digits indexes a list, anything else names a member.
function indexOf(segment: string) {
  return /^\d+$/.test(segment) ? Number(segment) : undefined
}

type Container = Record<string, unknown> | unknown[]

// Where a segment lands: a key on an object, an index on a list. An index past
// the end would leave a hole no schema accepts, so it names the entry that has
// to be written first instead.
function slotAt(container: Container, segment: string, { opt }: SlotWrite) {
  if (!Array.isArray(container)) {
    return segment
  }
  const i = indexOf(segment)
  if (i === undefined) {
    throw new Error(
      `Invalid track option "${opt}": "${segment}" names a member of a list; use an index`,
    )
  }
  if (i > container.length) {
    throw new Error(
      `Invalid track option "${opt}": index ${i} comes before index ${container.length}, which nothing has written`,
    )
  }
  return i
}

function readSlot(container: Container, at: string | number) {
  return Array.isArray(container)
    ? container[at as number]
    : container[at as string]
}

function setSlot(container: Container, at: string | number, value: unknown) {
  if (Array.isArray(container)) {
    container[at as number] = value
  } else {
    container[at as string] = value
  }
}

// The container to walk into under `segment`, made to the shape the NEXT
// segment asks for. A scalar there is replaced — a path keeps the rest of a
// setting, and a scalar has no rest to keep — but a list where the path wants
// an object, or the reverse, is two writes disagreeing about one setting, and
// carrying on would drop whichever came first.
function containerUnder(
  container: Container,
  at: string | number,
  wantsList: boolean,
  { opt }: SlotWrite,
): Container {
  const existing = readSlot(container, at)
  if (wantsList ? Array.isArray(existing) : isPlainObject(existing)) {
    return existing as Container
  }
  if (isPlainObject(existing) || Array.isArray(existing)) {
    throw new Error(
      `Invalid track option "${opt}": "${at}" is ${wantsList ? 'a setting, not a list' : 'a list, not a setting'}`,
    )
  }
  const made: Container = wantsList ? [] : {}
  setSlot(container, at, made)
  return made
}

/**
 * Apply one `path=value` write to `target`, creating the objects and lists the
 * path walks through and leaving everything beside them alone, so the writes of
 * one command line compose whatever order they come in.
 *
 * Indexing a list is what carries the grammar: `marks`, the `transform` steps
 * under a mark and an aggregate's `ops` are all lists of objects, and while a
 * path stopped at the first of them a declared figure could only be written as
 * raw JSON.
 */
export function applySlotWrite(
  target: Record<string, unknown>,
  write: SlotWrite,
) {
  const { segments, value } = write
  let container: Container = target
  for (const [i, segment] of segments.slice(0, -1).entries()) {
    container = containerUnder(
      container,
      slotAt(container, segment, write),
      indexOf(segments[i + 1]!) !== undefined,
      write,
    )
  }
  setSlot(container, slotAt(container, segments.at(-1)!, write), value)
  return target
}
