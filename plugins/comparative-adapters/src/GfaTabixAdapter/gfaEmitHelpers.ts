// Shared GFA emission helpers used by both subgraph builders
// (`gfaSubgraphBuilders.ts` for per-segment, `gfaCoarsener.ts` for the
// runtime coarsener). The two builders use different topologies — set-based
// BFS vs linear ref-walk — but agree on output-side conventions: bidirected
// edge canonicalization, PanSN path-name parsing, and orientation glyphs.
// Keeping these in one place ensures the canonical form of a link, the
// W-line PanSN split, and orientation chars are identical regardless of
// which builder produced the line.

export function flipOrient(o: string) {
  return o === '+' ? '-' : '+'
}

// `>` for forward, `<` for reverse — the W-line walk-string convention.
// Input is the segment-record orient byte (0 = forward, 1 = reverse), not
// the GFA char-code orient.
export function walkOrient(o: number) {
  return o === 0 ? '>' : '<'
}

// `L a oA b oB` and `L b ~oB a ~oA` are the same physical bidirected edge.
// Pick the lexicographically smaller string representation as the canonical
// form so emission de-duplicates regardless of which side adjacency was
// read from. IDs are pre-formatted strings (e.g. `s42` or `super_3`); the
// caller chooses the naming scheme.
export function canonicalLinkKey(
  srcId: string,
  srcO: string,
  tgtId: string,
  tgtO: string,
) {
  const forward = `${srcId}\t${srcO}\t${tgtId}\t${tgtO}`
  const reverse = `${tgtId}\t${flipOrient(tgtO)}\t${srcId}\t${flipOrient(srcO)}`
  // Lexicographic comparison — `Math.min` would coerce strings to NaN.
  // eslint-disable-next-line unicorn/prefer-math-min-max
  return forward < reverse ? forward : reverse
}

// PanSN parse for W-line emission: `sample#hap#contig` → 3 fields.
// Names without 3 `#`-separated fields fall back to `(name, 0, name)` so
// downstream tools always see a 7-column W-line.
export function parsePanSn(name: string) {
  const parts = name.split('#')
  if (parts.length >= 3) {
    return {
      sample: parts[0]!,
      hap: parts[1]!,
      contig: parts.slice(2).join('#'),
    }
  }
  return { sample: name, hap: '0', contig: name }
}
