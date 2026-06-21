- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- aggressively refactor generate-screenshots
- group by strand plugins/canvas

## Coloring

Swap order in colo829


## links for color by strand, PUR



## vendor electron-updater


## Fused abortsignal+stoptoken?

## mouseover

mouseover the individual peptide letters in gene glyph tooltip


## matrix


1. Side-by-side figure (painting + genotypes)

Added a trio-hapibd-matrix screenshot spec and figure to the tutorial: the hap-ibd painting stacked above the trio VCF, at chr1:61.5–66.5M (a window with two crossovers — maternal ~62.3M, paternal ~65.3M).

Per your feedback, it uses LinearMultiSampleVariantDisplay (regular, phased), not the matrix display — the matrix lays variants out in evenly-spaced columns that don't share the genomic x-axis, so the BED painting couldn't line up. With the regular display the genotype rows sit at their genomic positions and the painting's crossover boundaries align with the rows below.

2. Direct trio-genotype script

Added trio_crossovers.py to the tutorial as a command-line script. It reads the transmitted parental copy straight off the genotypes (no hap-ibd) and emits the same painted BED format, so it drops into the same display config. A --min-sites flag exposes the switch-error tradeoff.

On your "in the app vs command-line" question: command-line, clearly — and I made the script + tutorial say so. Reasons:
- It's a one-time, dataset-specific preprocessing step, not a rendering concern — keeping it out of the app keeps JBrowse focused on visualization.
- The result is brittle and judgment-dependent: on this statistically-phased VCF the crossover count swings 53 → 6 → 0 as --min-sites goes 100 → 200 → 400. That kind of parameter sensitivity is exactly what you don't want baked into a viewer; it belongs in a script you can tune and inspect.
- It needs sample IDs / pedigree as input anyway, which is awkward in-app.

The honest bottom line (now written into the "Is hap-ibd the right tool?" section): neither hap-ibd nor the direct method can give exact crossovers from this data, because the 1000G VCF is statistically phased and carries switch errors. For exact breakpoints you'd re-phase trio-aware/read-backed first.

Verified state

- Both figures render correctly (regenerated via the generator against the dev server).
- figure-manifest.json updated — both auto-link to live views.
- pnpm lint-docs-check passes; spec file lints clean.
- My changed files: test_data/config_demo.json, website/docs/tutorials/analyze_trio.md, website/scripts/screenshot-specs.ts, website/scripts/figure-manifest.json, and the two new PNGs. (The data BED on jbrowse.org/demos/kgp-trio/ is the 4-row version, CDN-invalidated.)

One thing I did not do: add the direct-script output as a second demo track. The hap-ibd consensus painting is the cleaner showcase, and the script is presented as the "in principle more correct, but noisier here" alternative. Say the word if you'd like a second track (or a side-by-side of hap-ibd vs direct) added too.

## color by cds reference sequence track

should also color by cds

## add strand arrows on sides of screen when zoomed in

## bundle size...not compressed on main
