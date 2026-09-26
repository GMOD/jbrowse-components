---
name: pending-calls
description: The one call left from the arc band geometry round, answered by Colin on 2026-09-25 and not built: landing regenerates. The colour range on a baked field (built 2026-09-26) and the band's port onto the link mark (ADR-170) are done. Read before touching the land path's generators.
---

Decisions answered 2026-09-25. Each premise below was verified against the code
— read the pointer rather than re-deriving it. The band's port onto the link
mark is built (ADR-170), and a declared colour on a preset read field paints
(`declaredReadCategoryColors`, 2026-09-26). **Delete this file once the last
one is built.**

## 2. Landing regenerates

Measured 2026-09-25: **26 of the last 200 commits are standalone
`pnpm autogen`**, all from that one day. Main sat red on stale generated
artifacts for most of the round, and the pre-commit hook says outright that the
commit it names is "where it was last re-checked, NOT what broke it", so every
agent that commits meanwhile pays the attribution cost before it can tell
whether the staleness is its own.

**Answered: yes, on the land path.** A branch fast-forwards into main once, so
it is one run per branch. Not the pre-commit hook: that measured ~60 s wall
clock, and several generators compile the live tree.

`.githooks/post-merge` is the seam.

## Not a call, and not fixable

`540312de13` carries shader output emitted from an older tree — a rebase
conflict in `*.generated.ts` resolved by taking a side instead of regenerating,
which is the case `CLAUDE.md` names. `855427e5fd` fixed it forward 96 s later
and main regenerates clean today, so only a bisect landing exactly on that
commit builds off stale shaders.
