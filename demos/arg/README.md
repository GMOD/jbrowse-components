# arg demo

An ancestral recombination graph as a JBrowse display, rendered by the
out-of-tree
[jbrowse-plugin-arg](https://github.com/cmdcolin/jbrowse-plugin-arg), which is
not bundled in JBrowse Web. The plugin reads a [tskit](https://tskit.dev) tree
sequence in the browser and draws its local trees along the genome — x is
genomic position, y is node time.

## The data is simulated, and the coordinates are real

`chr20_sim.trees` is an msprime coalescent simulation — 50 haplotypes, 10 Mb,
`recombination_rate=1e-8`, `Ne=10000`, seed 42 — whose edge coordinates are then
shifted onto **hg38 chr20:1,000,000-11,000,000** and whose `sequence_length` is
set to chr20's real length. `scripts/simulate_chr20_demo.py` in the plugin repo
regenerates it.

That shift is what makes the demo worth looking at: tree-sequence coordinates
are genomic, so a simulated genealogy sits under the real RefSeq genes at the
locus, which is the thing this display exists to let you do. **It is not a
genealogy of real people** — the track name says msprime, and it should keep
saying so.

Outside the simulated window the tree sequence has no edges. The display draws
nothing there rather than a line along the floor, which is what the payload's
per-tree `edgeCount` is for; a span with no genealogy and a genealogy that
coalesces at time zero are not the same thing.

## Why the plugin bundle is pinned by hash

`umdUrl` names `demos/arg/<hash>/`, uploaded immutable, not the unversioned copy
beside it. The unversioned one has a 60-second cache life and moves whenever the
plugin is rebuilt; a demo link that must keep working — and the screenshots in
the plugin README — should not change under it.

## Zoom is the whole story

The display switches detail on its own, so the interesting links are at
different scales rather than different loci:

- **~20 kb** — local trees as dendrograms under the genes. A tree draws its
  topology once it has 2 px per sample, so with 50 haplotypes that is about 100
  px of width.
- **~1 Mb** — a TMRCA skyline. Every tree is far below that width, so all of
  them collapse to the height their root coalesces at.

Both are in the plugin README's link table.
