// `--filter a,b --filter c` for the figure tools: the screenshot generator
// selecting specs to render, and `figures push` selecting figures to publish.
//
// Its own module rather than a pair of exports on `screenshot-specs.ts`, where
// they used to live, because that module imports every spec file in
// `scripts/specs/` — so `figures.ts` asking for a five-line string matcher would
// have loaded the whole spec registry, and `figures push` runs in CI on a
// checkout that has no reason to parse any of it.

// Split `--filter a,b,c` into trimmed, non-empty tokens. Takes an array because
// the flag is declared `multiple`, so repeating it (`--filter a --filter b`)
// unions the tokens. It used to be a plain string, where node's parseArgs keeps
// only the last occurrence — a repeated flag silently rendered one spec and
// skipped the other, which reads as the skipped one being up to date.
export function parseFilterTokens(filter: string[] | undefined) {
  return (filter ?? []).flatMap(f =>
    f
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
  )
}

// True when `name` matches any filter token (exact name or substring). An empty
// token list matches everything, so an absent --filter selects all specs.
export function matchesFilterTokens(
  name: string,
  tokens: string[],
  exact: boolean,
) {
  return (
    tokens.length === 0 ||
    tokens.some(t => (exact ? name === t : name.includes(t)))
  )
}
