import type { DisplaySnapshot } from './displaySettings.ts'

// Aliases for the displays a track type has beyond its default, with any
// settings the alias implies. `display:<anything-else>` passes through.
const displayTypeAliases: Record<
  string,
  { type: string; settings?: DisplaySnapshot }
> = {
  marks: { type: 'LinearMarkDisplay' },
}

// `Object.hasOwn` because the key is raw command-line input, and `constructor`
// is inherited from Object.prototype
export function displayAlias(name: string) {
  return Object.hasOwn(displayTypeAliases, name)
    ? displayTypeAliases[name]!
    : { type: name }
}

/**
 * The display a `display:` modifier asks for; the last one given wins. Its own
 * module so a linear view's init can read it without the slot tables.
 */
export function requestedDisplayType(modifiers: string[]) {
  const name = modifiers.findLast(mod => mod.startsWith('display:'))?.slice(8)
  return name ? displayAlias(name).type : undefined
}
