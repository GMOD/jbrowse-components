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

// A `jexl:` item runs to the first comma outside its own brackets and quotes,
// since a jexl call separates its arguments with commas.
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
    } else if (c === ',' && depth === 0) {
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
 * what was there, so `color.field=…` and `color.palette=…` fill one object in
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

/** `color.palette=tan,teal` as the settings object it writes: `{ color: { palette: [...] } }`. */
export function slotPathSettings(opt: string) {
  const eq = opt.indexOf('=')
  const segments = opt.slice(0, eq).split('.')
  if (segments.includes('')) {
    throw new Error(`Invalid track option "${opt}": an empty path segment`)
  }
  return segments.reduceRight<unknown>(
    (value, segment) => ({ [segment]: value }),
    slotValue(opt.slice(eq + 1)),
  ) as Record<string, unknown>
}
