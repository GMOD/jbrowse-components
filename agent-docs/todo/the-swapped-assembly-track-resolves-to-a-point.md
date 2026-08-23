---
name: the-swapped-assembly-track-resolves-to-a-point
description: the hang is fixed; what is left is the swap, still not isolated
metadata:
  area: synteny
  category: measure-first
---

# The swapped-assembly track resolves to a point

The hang this used to describe is fixed, and it was the follow's, not the swap's:
`alreadyShowing` can never agree with an answer narrower than the moving view's
zoom floor, and saying no means navigate, which wakes the pass that asked. A
zero-width answer now holds the row and lights `followUnaligned`, a narrow one
is matched by containment within the floor, and
`LinearSyntenyFollow.test.tsx` covers a follow on a swapped track. See
`SyntenyFollow/CLAUDE.md`.

What is left is why the answer is degenerate. `volvox_del.paf` declares rows
`["volvox", "volvox_del"]` while its adapter declares
`queryAssembly: volvox_del` / `targetAssembly: volvox`, so the level's top row is
the adapter's *target* — the swapped-assemblies case the codebase already warns
about elsewhere — and the walk clamps the anchor window to a block whose axes are
not what the plan thought, bringing both ends back on one coordinate.
`volvox_alias_control.paf` describes the same alignment with the orientation
aligned and resolves normally (`LinearSyntenyRefNameAlias.test.tsx`).

So the follow is safe on such a track but useless on one, which is the honest
state to leave it in until the swap itself is addressed: the two fixtures differ
in orientation *and* in column order, so it is still not isolated to one
variable — one more fixture would settle that. The user-facing answer may be that
`swappedAssembliesWarning` should reach the follow's own reporting rather than
that the walk should be taught to cope.
