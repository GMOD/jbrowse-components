# SyntenyFollow

The continuous form of "Move bottom panel to the matching region": that item
resolves one alignment on a click, this resolves whichever alignment is under
the anchor row's window, every time the anchor moves, for every other row. It
maps the anchor's visible **window**, not a midpoint, which is also what makes
the moved row match the anchor's _scale_.

Nearly all of this is about placement happening **twice, on two clocks**.

## Rules

Each is a section of
[reference/SYNTENY_FOLLOW.md](../../../../agent-docs/reference/SYNTENY_FOLLOW.md),
which has the why — read that section before changing what it covers.

- Two passes, because the exact answer costs an RPC
- The map is what makes the two clocks agree
- Three rungs, coarsening as the anchor's window widens
- The third rung is offered, not taken automatically
- Ordering is outward from the anchor, not by level index
- `planLevel` is the only place observables are read
- `seq` is bumped per PASS, not per resolve
- What each pass may touch
- A gesture on a followed row takes the anchor
- That convergence is load-bearing, and nothing else damps it
- The follow can only reach contigs the moving row already displays
- Every refName the follow reads is canonical, made so in two places
- Approximate is a state the UI reports, not a failure
- Orientation is matched once per decision, and only when opted in
- Block coordinates are `start <= end`, with direction in `strands`
- `levelStates` is keyed by the level node
- Navigating a followed row from elsewhere in the view takes the anchor
