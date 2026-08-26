---
name: the-swapped-assembly-track-resolves-to-a-point
description: the follow's hang is fixed, but on a PAF whose rows and adapter disagree about which assembly is the target, the walk clamps the anchor window to a block whose axes are not what the plan thought and brings both ends back on one coordinate — safe on such a track and useless on one, and the two fixtures still differ in orientation AND in column order
---

# The swapped-assembly track resolves to a point

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The hang is fixed and the remaining state is honest: the
follow is safe on a swapped track and useless on one, and the two fixtures
still differ in two variables at once.

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
