---
name: re-render-the-five-figures-the-settings-menu-refactor-outran
description: five stale; the lock cannot catch this class
metadata:
  area: figures, synteny
  category: ready
---

# Re-render the five figures the settings-menu refactor outran

`figures.lock` was last written partway through that refactor, and two commits
after it reshaped the menu those figures photograph — a slider became a chevron
row and the sections were reordered by arity, so every captured menu is a
picture of a shape that no longer exists. `genomes_synteny/ribbons_default` also
boxes **CIGAR indels** and **Curved lines** at rows that have since moved, and
it contradicts the prose committed alongside it ("checkboxes come first, then
the choices, then the values").

Stale, all needing the browser pipeline:

- `genomes_synteny/ribbons_default`
- `genomes_synteny/ribbon_settings` — `mode: 'compose'` over the above
- `hg002_haplotypes_location_markers` — its `viewportHeight: 500` was sized for
  the taller pre-refactor menu and wants re-checking, not just re-rendering
- `bigwig/whole_genome_coverage`
- `tracklabels` — its viewport grew

The first three are the ones the refactor itself invalidated; the last two were
already known. Nothing in the lock can catch this class — it hashes the bytes in
S3, not whether the UI still looks like them.
