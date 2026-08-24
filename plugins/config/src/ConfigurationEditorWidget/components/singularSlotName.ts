/**
 * Singularize a config schema slot name for the per-entry label an array-typed
 * sub-schema renders ("displays" -> "display LinearBasicDisplay").
 *
 * Slot names are developer-authored camelCase identifiers — `displays`,
 * `tracks`, `connections` are the ones in tree — so the regular English endings
 * are the whole domain. This replaced the `pluralize` dependency, whose value
 * is its irregular-noun table, and nothing here is ever an irregular noun.
 *
 * The counterpart for label text, where the noun comes from a display rather
 * than a schema key, is core's own `pluralize(count, noun)` in `stringUtils`.
 */
export function singularSlotName(name: string) {
  return /[^aeiou]ies$/.test(name)
    ? `${name.slice(0, -3)}y`
    : /(?:s|sh|ch|x|z)es$/.test(name)
      ? name.slice(0, -2)
      : // a trailing `s` after `a`/`i`/`u`/`s` belongs to a word that is already
        // singular — `bias`, `alias`, `axis`, `status`, `class` — not to a plural
        /[^saiu]s$/.test(name)
        ? name.slice(0, -1)
        : name
}
