# Items needing browser verification

## Synteny deletion polygons extend beyond LGV boundaries

**Test case:** 3-way volvox, zoom in on an alignment with CIGAR ops, look for
`D`/`N` polygons that visually bleed beyond the LGV coordinate range.

**Static analysis summary:** The code looks correct — `visitCigarRenderedSegments`
advances `cx1` only for D/N (reference-only ops), `computeCorners` math is
correct, and polygons that extend past the canvas edge are GPU-clipped. Each
synteny level has its own canvas, so cross-level bleed is not possible.
`buildSyntenyGeometry.ts` is entirely new on this branch (not in `origin/main`),
so there is no regression baseline to compare against.

**If the bug IS visible:** Check whether the `minW` widening in `syntenyFill.slang`
(the `w < minW` branch) is causing the degenerate bottom point of D/N triangles
to expand horizontally beyond region boundaries in multi-region LGV layouts.
Also check the `padTop * (scale0 - 1.0)` correction in `computeCorners` for
off-by-one in multi-region `padTop` values.
