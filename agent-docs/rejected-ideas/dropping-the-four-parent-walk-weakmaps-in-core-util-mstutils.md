---
name: dropping-the-four-parent-walk-weakmaps-in-core-util-mstutils
description: Dropping the four parent-walk `WeakMap`s in `core/util/mstUtils.ts`
area: performance-and-measurement
---

# Dropping the four parent-walk `WeakMap`s in `core/util/mstUtils.ts`

—
measured 2026-08-18 and declined, because unlike the three memos above them in
this file they are actually buying something.
`packages/core/benches/parentWalkMemo.bench.ts`:

- The walk costs **13.6-17.6x** the memoized lookup over five runs, and still
  **3.2-3.7x** inside a reaction. `getSession` alone has 465 call sites and is
  reached from render paths.
- Cost is linear in DEPTH, not in node count: 1 node and 200 nodes cost the
  same per call. Display to session is six `getParent` hops, because every MST
  array in between is a node of its own.
- **The predicate is not the cost, so a cheaper one is not the alternative.**
  The suspicion was `isSessionModel`'s two `in` checks going through MobX's
  `has` trap; one `in` is ~70ns against a 6.2-7.0us bare walk with no predicate
  at all, ~1% of it. It is MST's own `getParent` and `isAlive`, six hops of
  each. That arm runs last and absorbs the earlier arms' GC — its absolutes
  moved 2x across runs, its ratio did not.

What separates these from the memos that were removed is the key: a live MST
node, not a temporary the caller just allocated. `containingDisplayCache` is
the one with no internal caller left (`getContainingDisplay` is re-exported for
the plugin ABI and nothing in the repo calls it) — kept anyway, because an
unused `WeakMap` holds nothing and an external caller gets the same 14x.
