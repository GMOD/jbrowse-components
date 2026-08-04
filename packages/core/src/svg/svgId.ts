/**
 * SVG ids in an export are routinely built out of config data — a `trackId`, a
 * `displayId`, a block key carrying a refName. All three are arbitrary strings
 * from a config file or a FASTA header, and an id is not just an attribute: it
 * is pointed at by `clip-path="url(#id)"` / `fill="url(#id)"`, which is a CSS
 * `url()` token. An unquoted `url()` cannot hold whitespace, parentheses or
 * quotes, so a track named `Genes (curated)` or a refName like
 * `gi|123|ref|NC_000001|` silently produced an unresolvable reference: the clip
 * never applied and the track painted over its neighbours, or the gradient fill
 * came out transparent.
 *
 * Percent-encoding is the wrong tool here even though the characters line up —
 * a fragment reference is percent-*decoded* before it is matched against an id,
 * so `url(#a%20b)` looks for the id `a b`, not `a%20b`, and encoding both ends
 * just moves the mismatch.
 *
 * So: escape to a safe alphabet instead. `~` is the marker because it is legal
 * in both an id and a `url()`, and essentially never appears in a real trackId
 * — which means ordinary ids pass through byte-for-byte and no existing export
 * changes.
 */

// Everything outside this set is escaped. `\w` is [A-Za-z0-9_]; `.`, `-` and
// `:` are added because existing ids (block keys are `refName:start:end:idx`)
// are full of them and all three are safe in an id and in a `url()`. `~` is
// deliberately NOT in the set, so it escapes itself and the mapping stays
// injective — two ids that differ only in an unsafe character must not collide
// into one, or the second element silently steals the first's clip.
const UNSAFE_ID_CHAR = /[^\w.:-]/g

/**
 * Make an SVG id safe to both carry in an `id` attribute and point at with
 * `url(#...)`.
 *
 * Injective but NOT idempotent — escaping the marker is what buys injectivity,
 * so a second pass re-escapes the `~`s the first one wrote. Apply it exactly
 * once, at the place that emits both the id and the reference to it
 * (`SvgClipRect` and `SvgGradientLegend` already do; a hand-rolled `<clipPath>`
 * must). Double-applying is harmless to correctness — the id and its `url()`
 * still agree, since both are derived from one call — but it produces noisy ids
 * for no reason.
 */
export function svgSafeId(id: string) {
  return id.replaceAll(
    UNSAFE_ID_CHAR,
    c => `~${c.codePointAt(0)!.toString(16)}~`,
  )
}
