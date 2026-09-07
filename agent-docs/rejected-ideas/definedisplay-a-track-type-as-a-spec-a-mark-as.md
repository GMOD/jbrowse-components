---
name: definedisplay-a-track-type-as-a-spec-a-mark-as
description: `defineDisplay`: a track type as a spec, a mark as a shape plus channels, and a declared settings table under them
area: rendering-and-displays
---

# `defineDisplay`: a track type as a spec, a mark as a shape plus channels, and a declared settings table under them

(ADR-089, ADR-090, and the branch that
tried the table; also `ideas/a-track-type-is-five-primitives`, the proposal
behind all three) — all rejected on 2026-08-24 and removed from the tree,
[ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md).
The factory was gauged on `example-plugins/score-example` (two settings, no
layout, one mark) and then tested on an in-tree display: `LinearManhattanDisplay`
fit only through six spec fields that were each an override hook with one
consumer, a ~478-line imperative `extend` and an RPC serialization the spec
could not hold, and it put a spec's chrome and drawing onto the gwas plugin's
startup path because a state model is eager — 34 modules and 216,947 bytes of
source, re-derived in ADR-091's Context from the commits that landed. The
data-only settings table left behind eliminated 0 of 60 declarable getters,
derived a correct fetch payload on 1 display in 6, and gave every shared
setting a second owner. A spec that holds a display's wiring and nothing else
is not worth keeping for third parties either: they get the same hand-composed
stack the in-tree displays use, through the published subpaths, which is what
`score-example` shows again. Its four config-read fixes were salvaged onto
main. The port and the table were measured on a branch called
`worktree-manhattan-lazy-spike`, which this file and ADR-091 both cited as
"the record" and which exists nowhere — so every figure above except the
closure is unre-derivable, and ADR-091 marks each one.
