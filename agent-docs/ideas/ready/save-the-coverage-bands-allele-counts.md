---
name: save-the-coverage-bands-allele-counts
description: Save track data writes the coverage band's depth only, as a bedGraph, while the per-base allele counts already exist as a table; a save format beside the bedGraph is what is left.
---

# Save the coverage band's allele counts

The tables export already carries them: `alleleCoverage` in
`plugins/alignments/src/tables.ts` (position, base, depth). Save track data
still writes the depth only, as a bedGraph
(`plugins/alignments/src/saveTrackFormats/coverage.ts`), so what is left is a
save format beside the bedGraph, built over that table.
