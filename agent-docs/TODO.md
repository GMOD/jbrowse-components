- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?

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

## add strand arrows on sides of screen when zoomed in



## proressive reveal menu items weird

also, once 'view pairs' is enabled, does more menu items appear? might want a better system for this progressive reveal

Let me verify exactly what reveals and when, since the pair-filter reveal is gated on a second condition.

  Searched for 2 patterns, read 1 file, ran 1 shell command

Yes. Confirmed by reading the code — and there are actually two independent reveal groups in that one menu:

- Enabling "View as pairs" reveals Show singletons + Show proper pairs.
- Enabling either overlay (Show read arcs or Show read cloud) reveals Draw below coverage band, Show off-screen mate connections, Show inter-chromosomal pairs.
- Show read links as bezier curves is always last.

One thing worth fixing regardless: the pair-filter gate is redundant. The menu passes showPairFilters: self.isChainMode, and isChainMode is linkedReads === 'normal' — which is the exact same condition as linked (linkedReads !== 'off', and the type is only 'off' | 'normal'). So linked && showPairFilters is just linked twice. The showPairFilters param is vestigial (probably from when there were more linked modes). Could drop it.

On "a better system"

The team's stated rule (per the code comments) is reveal, never show-disabled — so greying-out is off the table. Within that, the real cognitive cost isn't the reveal itself, it's that revealed items appear inline in a flat list with no cue about which toggle they belong to, and the menu reflows under your cursor.

Two levels of fix:

Cheap, high-value (UX): bracket each revealed group with a divider and give the children a subLabel tying them to the parent, so when they pop in they read as a clear cluster instead of "where did these three rows come from." No new abstraction.

Structural (code): a tiny declarative helper so the pattern stops being ad-hoc ...(cond ? [a,b] : []) spreads repeated across readConnections, sashimi, and colorBy:

// each entry is always present in source; `children` reveal when `expanded`
group(checkboxItem('View as pairs', linked, toggle), {
  expanded: linked,
  children: [singletons, properPairs],
})

The helper flattens to the same MenuItem[] the renderer wants, but the dependency is expressed structurally in code (parent owns its children) instead of as a separate boolean condition repeated next to a separate array — which is also what would've prevented the redundant-gate confusion above.

My recommendation: do the redundant-gate cleanup now (it's a clear bug-adjacent simplification), and if you want the reveal to feel less jarring, the divider+subLabel touch — it's the lighter lift and directly serves the low-overhead goal. The declarative helper is nice but only pays off if you're willing to migrate all three menus to it.

Want me to apply the gate cleanup, and/or prototype the helper on readConnections so you can see it before committing to the pattern?

✻ Baked for 1m 12s

❯ for example, the 'show proper pairs' thing...that could be in the show submenu all the time
