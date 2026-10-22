import {
  applySlotWrite,
  isMemberWrite,
  isSlotPathOption,
  mergeSettings,
  slotWrite,
} from './slotPath.ts'

// One rule for every modifier value, so the grammar reads the same whatever the
// track type: a value that isn't one of the things the modifier accepts is an
// error. jb2export writes a figure and exits, so a warning about a typo scrolls
// past and leaves a wrong image behind: `arcs:upp` used to render a plot with no
// arcs at all.
export function invalidModifierValue(
  prefix: string,
  val: string,
  expected: string,
): never {
  throw new Error(
    val === ''
      ? `Missing ${prefix} value. Expected ${prefix}:<${expected}>.`
      : `Invalid ${prefix} value "${val}". Expected ${expected}.`,
  )
}

// A bare `height:` would otherwise become a silent 0 via `+''`. `expected`
// names the wider grammar for the modifiers that also accept keywords.
export function parseNum(prefix: string, val: string, expected = 'a number') {
  const n = val === '' ? Number.NaN : +val
  return Number.isNaN(n) ? invalidModifierValue(prefix, val, expected) : n
}

// A modifier whose value is mandatory and free-form (a color, a tag, a display
// name): `color:` with nothing after the colon is a typo.
export function parseStr(prefix: string, val: string, expected = 'value') {
  return val || invalidModifierValue(prefix, val, expected)
}

// A value from a fixed set, returned as the matched member so the caller keeps
// the narrow literal type.
export function parseEnum<T extends string>(
  prefix: string,
  val: string,
  allowed: readonly T[],
) {
  return (
    allowed.find(a => a === val) ??
    invalidModifierValue(prefix, val, allowed.join(', '))
  )
}

// Bare (`force`) or `:true` is on, `:false` is off, anything else is a typo.
export function parseBool(prefix: string, val: string) {
  return val === '' || val === 'true'
    ? true
    : val === 'false'
      ? false
      : invalidModifierValue(prefix, val, 'true or false')
}

/**
 * A JSON modifier, reported with its token, since a bare SyntaxError from a
 * shell-mangled brace names nothing.
 */
export function parseJsonModifier(token: string): Record<string, unknown> {
  try {
    return JSON.parse(token) as Record<string, unknown>
  } catch (e) {
    throw new Error(`Invalid JSON track option: ${token}`, { cause: e })
  }
}

/** The colon modifiers that write the same setting on every track type. */
export const sharedModifiers: Record<
  string,
  (val: string) => Record<string, unknown>
> = {
  height: val => ({ height: parseNum('height', val) }),
  force: val => ({ forceLoad: parseBool('force', val) }),
}

/**
 * A track's display settings from the modifiers that mean the same on every
 * track type: a JSON object, a whole-setting `path=value` write, `height:` and
 * `force:`. `rest` is the others in order: the colon modifiers whose setting
 * depends on the display (`color:`, `featureHeight:`, `sort:`) and the member
 * writes (`color.field=`), which merge into the track's configured value.
 */
export function trackSettings(modifiers: string[]) {
  const settings: Record<string, unknown> = {}
  const rest: string[] = []
  for (const mod of modifiers) {
    const name = mod.split(':')[0] ?? ''
    if (mod.startsWith('{')) {
      mergeSettings(settings, parseJsonModifier(mod))
    } else if (isSlotPathOption(mod) && !isMemberWrite(mod)) {
      applySlotWrite(settings, slotWrite(mod))
    } else if (Object.hasOwn(sharedModifiers, name)) {
      Object.assign(settings, sharedModifiers[name]!(mod.split(':')[1] ?? ''))
    } else {
      rest.push(mod)
    }
  }
  return { settings, rest }
}
