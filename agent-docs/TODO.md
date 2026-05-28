## test speedups
  You were right that the import graph is the problem — but it's only ~⅓ of the cost.

  ┌──────────────────────┬─────────┬───────┐
  │       Variant        │ Modules │ Time  │
  ├──────────────────────┼─────────┼───────┤
  │ Pure noop test       │       1 │ 0.73s │
  ├──────────────────────┼─────────┼───────┤
  │ 5 plugins            │     381 │ 2.58s │
  ├──────────────────────┼─────────┼───────┤
  │ Current (30 plugins) │   1,512 │ 3.33s │
  ├──────────────────────┼─────────┼───────┤
  │ Real test (10 tests) │  1,512+ │ 11.3s │
  └──────────────────────┴─────────┴───────┘

  The math for a 2× warm-cache win:
  - Trim corePlugins to per-test minimum: saves ~0.7s/file → ~10% on heavy tests, ~25% on light tests
  - Share JBrowse mount across tests in same file: saves ~3–5s per heavy file
  - Combined: realistic path to ~1.6–1.8×. Honest 2× requires both.

  SWC / esbuild / Vitest: 0% local warm-cache help. Confirmed by profile (babel is 1.8% CPU on real
  tests).

  What I'd actually do, in order:
  1. Make getPluginManager() in util.tsx accept a plugin list (default = corePlugins). Migrate the
  lightest tests to pass [LinearGenomeView, Config, Menus, Sequence, DataManagement]. Quick win, low
  risk.
  2. Audit one heavy plugin barrel (e.g. linear-comparative-view/src/index.ts reaches 504 files) to
  see if non-lazy imports can become lazy() — would benefit all tests.
  3. Only then consider sharing mounts across tests — bigger refactor, harder to keep correct.

  If you want, I can do step 1 as a real PR (refactor util.tsx + convert ~5 light tests) and measure
  the suite delta.


## Autogen docs


 Two notes worth flagging:
  1. plugins/variants/src/shared/SharedVariantConfigSchema.ts has a #slot JSDoc on a
  ...sharedVariantConfigSlots spread; the new extractor honours it and emits a blank-named slot. The
  old code silently dropped it. Either remove that #slot JSDoc or push the per-slot JSDocs down to
  where the fields are actually declared.
  2. The README's instructions for the dummy-function workaround were rewritten to describe the actual
   JSDoc-adjacency rule.



## Alignments/maf


Architecture Observation (informational, not a bug)

The three-loop pattern in computeNoncovCoverage mirrors the same Map.get + default-create + increment pattern that appears for insertions, softclips, and hardclips. This is the most structurally repetitive part of the pipeline — a small accumulate(map, items, field) helper (as shown above in finding #2) would cut the file from 183 lines to roughly 150 while making the logic much easier to scan.

The MAF coverage path is correctly narrower than alignments (no noncov, no mod coverage) and correctly shares computeSNPCoverage and packCoverageBinsForGpu/packSnpSegmentsForGpu from alignments-core. The main opportunity is finding #3 above — computeMafCoverage can shed the intermediate MismatchEntry[].

✻ Worked for 7m 2s

❯ do whatever you think is best. if helpful you can create new helper functions, or react components, or tighten types. note that MAF can have insertions, so it does need 'noncov' i think (noncov includes insertions and interbase events. it might even want to be renamed interbase)

Let me understand the scope of the noncov→interbase rename and the MAF insertion situation before diving in.

  Searched for 2 patterns, ran 2 shell commands

The rename touches ~30 files including generated shaders. Let me check what the slang source looks like and if I can regenerate.

## MAF


- Move the defensive Math.min(alignment.length, refSeq.length) to one place — it appears in 5 hot loops. Better: assert the invariant once at the worker boundary in LinearMafGetAlignmentData so downstream code can drop the guards. Skipped because it touches the worker output contract and merits a separate look.
- Extract caseFoldedEqual(a, b) for the (a | LOWER_BIT) === (b | LOWER_BIT) pattern in resolveCellColor + computeVisibleLabels. Considered, but a one-liner helper for a 2-token expression is more friction than win — left inline.
- Insertion-glyph extraction to alignments-core — plugins/maf/.../insertions.ts and plugins/alignments/src/features/insertion/drawCanvas.ts share the small-vs-large branch and border drawing pattern. Real refactor opportunity but non-trivial; worth its own PR.




