- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



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

## add strand arrows on sides of screen when zoomed in

## importform

i clicked http://localhost:3000/?config=test_data%2Fhs1_vs_mm39%2Fconfig.json and it went to the
  linearsyntenyview import form instead of launching the view i think. can you please audit why this
  occurred

## unified dotplot/synteny progress reporting


The original ask — synteny ribbon loading/progress:
- Synteny now surfaces progress during refetches (zoom-bucket crossings, region changes), not just first load. Added a fetching in-flight flag + refetching getter so the statusCallback (onProgress) data — message and determinate fraction — is actually shown while stale ribbons stay on screen, instead of being computed and discarded.

The unification (dotplot ↔ synteny "fetching panels"):
- Extracted the shared refetch chip into @jbrowse/synteny-core/RefetchIndicator — the natural home, alongside the already-shared createStopTokenRotation fetch primitive both plugins use.
- Both LinearSyntenyRendering (synteny) and DisplayStatusOverlays (dotplot) now render it. This also fixed a latent dotplot gap: its refetch chip previously dropped the statusProgress it computes, so it now shows the determinate bar too.
- Left the first-load overlays per-plugin (intentional visual difference) and left the model-level loading/refetching policy local, since dotplot and synteny have genuinely different first-load semantics — unifying those would force a behavior change or a typecast. The shared seam is the drift-prone presentation; the policy stays where it differs.

Verification: synteny-core rebuilt so the export resolves; tsgo + eslint clean; new render test asserts the indeterminate/determinate/fallback cases (including MUI's aria-valuenow).

I traced the onProgress channel end-to-end (PAFAdapter/PIF → fetchAndMaybeUnzip → downloadStatus → byte-granularity onProgress), so the determinate bar populates on real download phases and degrades gracefully to the indeterminate spinner otherwise.

One thing I left as your call: the refetch chip appears immediately (matching dotplot), so a very fast cached refetch can briefly flash it. Say the word and I'll add the same ~250ms anti-flash delay the core LoadingOverlay uses.

Let me give you a straight, critical self-assessment rather than just asserting confidence. I re-examined each piece for failure modes.

What I'm confident in (verified by reasoning + tests):

- The fetching/refetching state machine. I traced every path: supersede (token rotates, old fetch's finally is gated by isCurrent() so it can't clear the newer fetch's flag), success, error, and abort all settle correctly — refetching is never stuck true, and the flag is owned by "the latest fetch." This is the load-bearing part and it holds.
- Chip placement. I initially worried, then traced the DOM: synteny's .overlay is position: static, so the chip resolves against the nearest positioned ancestor — .wrapper (position: relative), which is exactly the level's canvas box. So bottom-right lands at the bottom-right of the ribbon area, per level. Correct by construction, and consistent with how the existing LoadingOverlay (inset:0) already anchors.
- Progress wiring. Traced end-to-end (PAFAdapter/PIF → fetchAndMaybeUnzip → downloadStatus → byte onProgress), degrades gracefully to indeterminate.
- Package placement. synteny-core already hosts the shared fetch primitive and shared UI; both plugins depend on it. Right home.

The honest caveats — where "makes sense for the user" deserves scrutiny:

1. I have not visually verified in a running browser. Everything above is reasoning + unit tests. For a "are you confident" answer, that's the real gap — I can reason about placement but I haven't seen the chip appear on a synteny zoom-refetch.
2. Unifying restyled dotplot's chip. Dotplot's old refetch text was bare (no background, opacity 0.7); the shared component gives it a paper background + rounded corners. That's a deliberate visual change to dotplot you didn't explicitly ask for. It's arguably more legible over a busy canvas — but it's a real side effect of unification.
3. Inherited limitation: multiple synteny tracks in one level would stack their chips at the same corner (dotplot has the identical behavior). Low impact — usually one track per level — but it's not handled.

My actual recommendation on the abstraction: the core, clearly-valuable change is the synteny refetch-progress fix (your original ask). The cross-plugin RefetchIndicator is polish I did because you pointed at dotplot — it buys consistency + a latent dotplot determinate-bar fix, at the cost of coupling two plugins through a ~30-line component and restyling dotplot. That part is a genuine taste call, not a correctness one.

So before I claim "done," two things would meaningfully raise confidence:

## bigwig generate-screenshots whole genome

second screenshot blank

✗ gene_track_collapse_introns: waitForSelector: still visible "[data-testid="loading-overlay"]"

## text boldness in sidebar...

## sashimi arcs are not updating on zoom

## pnpm dep in jbrowse-plugin-list reuploading everything every time to latest (???)

## resizebar a little too 'transparent', make a little more visible

## linesconnectingtogenomeposition no alpha, or maybe make a little thinner? look at v4.3.0 maybe
