---
name: handoff-v5-release-triage
description: The thirteen findings left open by the eight-lane correctness review of the v5.0.0 branch, each as a file:line and its mechanism, plus the two decisions that are Colin's. The four blockers and the release-note corrections have landed. Read before re-reviewing any of these subsystems.
---

# Handoff: the v5.0.0 release triage

Eight subagents read one subsystem each against
`website/release_announcement_drafts/v5.0.0.md`, over the ~1500 commits between
2026-08-13 and 2026-08-18. Lanes were commit churn crossed with the release-note
claims describing that area, so each had both a body of change and a set of
public promises to check against.

Four blockers, three migration repairs and one red snapshot have landed, and
nineteen release-note claims are corrected. What is below is what has not been
actioned. Move an item to `TODO.md` when someone commits to it.

**Read what a test asserts before trusting it here.** Every migration bug this
review found had a test covering the migration and asserting a different field;
the follow bug had a test that mocked the navigation *specifically to work
around it*, with a comment explaining the collapse. On a subsystem this heavily
tested, a green suite is not evidence.

## Open

Cited by symbol, not line — `main` moves fast enough that a line number here is
wrong within the week.

1. **The refName-mismatch warning is invisible with track labels hidden.**
   `TrackLabelRefNameWarning.tsx` is the sole reader of
   `BaseTrackModel`'s `refNameMismatch` getter, and it mounts only from
   `TrackLabel.tsx`, which `TrackContainer.tsx` renders under
   `effectiveTrackLabels !== 'hidden'`. Hidden labels put the commonest data
   mistake back to looking like an empty track; SVG export never renders it
   either. The release notes claim this case is covered.
2. **An assembly alias makes `&extendSession=` drop every track.**
   `applyDefaultSessionViewInit.ts` compares `pending?.assembly === assembly`
   where the rest of the subsystem resolves through the alias-aware manager.
   Silent — no tracks, no diagnostic.
3. **Fetch dedupe ignores credentials.** `InternetAccountModel.openLocation`
   hands each handle its own fetcher while the chunk cache keys on URL alone, and
   `fetchRun` binds `doFetch` from whichever handle planned the run — so two
   tracks on one URL with different auth cross over. Nothing calls
   `clearCacheFor`, so cached chunks outlive a credential change by the
   15-minute idle window. The cancellation half of the same mechanism is
   correct: `joinRun`/`abortIfUnwanted` reference-count readers.
4. **Four URL params are consumed and then discarded.** In `SessionLoader.ts`,
   the `extendDefaultSession && isJb1StyleSession` branch outranks the hub
   branch, so `hubURL` alongside `extendSession` never connects the hub and is
   still stripped from the address bar by `consumedParams`; `decodeHubSpec` gates
   `viewInit` on `loc || assembly`, dropping `regions=`/`tracklist=`/`highlight=`
   beside a comment about that fix being applied to `sessionTracks` only.
5. **The location box's dropdown and Enter disagree on a globbed refName.**
   `getRefNameOptions` (`RefNameAutocomplete/util.ts`) goes straight to
   `matchRefNames`, skipping the literal-first rule `searchUtils.ts` applies
   before its glob branch. `HLA-A*01:01:01:01` on a GRCh38 analysis set is the
   reachable case; both files document that they must agree, and
   `selectNamedRegions`' docstring names this input as why the rule exists.
6. **At fit height the clicked variant row is not the drawn row.**
   `rowsUnderCursor` (`variantCellLookup.ts`). The index math is right; the GPU
   samples at pixel centre and the hit test at the integer, so the error is
   `0.5 / rowHeight` — three rows at the default fit height with 2,504 samples.
   Same arithmetic in maf's `mafHitTest.ts`.
7. **`add-track --color` writes a dead setting and exits 0.**
   `add-track-utils/track-config.ts` merges it into `displayDefaults` for every
   track type, but `LinearAlignmentsDisplay` declares `colorBy`, and
   `expandTrackConfigShorthand` drops an unmatched key with a console warning.
   `jbrowse validate` catches it afterwards and names the right slot, so
   `add-track` could refuse it up front — it already knows the track type.
8. **`validate` never opens `connections`, `aggregateTextSearchAdapters` or
   `textSearching.textSearchAdapter`.** Grep `validateConfig.ts` for any of the
   three: zero hits, though `configManifest.generated.ts` carries both
   vocabularies. All three probed with deliberate typos and passed. A Trix path
   typo is a search that returns nothing, which is the class the command exists
   for.

   The same blindness reads the other way and produces a false positive.
   `test_data/volvox/config.json` track 90 (`volvox_del2.paf`) names assembly
   `volvox_del2`, which that file does not define and `validate` therefore calls
   an error — but `LGVSynteny.test.tsx` supplies it at runtime through a
   `JB2TrackHubConnection` onto `config2.json`. A validator that opened
   `connections` still could not resolve that one, since the connection is not
   in the config; what it can do is say that an assembly may arrive from a
   connection instead of ranking a spelling guess first. The other error in that
   file, track 76's `wombat`, is a deliberate fixture.
9. **The download progress bar runs backwards near the end.** `aggregateStatus`
   (`core/src/util/progress.ts`) drops completed slots from both numerator and
   denominator. It cannot exceed 100% or divide by zero — those two are closed.
10. **Every legacy single-tier `.pif.gz` refetches itself at 10,000 bp/px.**
    `lodTier.ts` resolves the tier from `coarseBpPerPxThreshold`, which both
    indexed adapters declare regardless of whether the file has a coarse tier —
    that fact is `PifFile.hasCoarseTier`, async and adapter-side. The fetch key
    changes and `resolveCoarseTier` then serves the fine tier again. Identical
    bytes, once per crossing. Waste, not wrong output.
11. **`runClustering` without `clusterRegion` is not reproducible.**
    `clusterRegions` (`runClusteringAutorun.ts`) falls back to the view's
    `dynamicBlocks.contentBlocks`, which are viewport-width dependent. The
    algorithm is deterministic; the input is not.
12. **`getTrackYOffset` is off by one label box per track.** Its
    `trackChromeHeight` term excludes the offset label box, and `offset` is the
    default `effectiveTrackLabels`. Live consumer is the breakpoint split view's
    connector fallback, whenever `domYOffsets` is unavailable. Documented in
    code, but `6a669368e5` is titled "the model's track offsets now match the
    pixels, exactly".
13. **Two transfer-list producers have never been checked.**
    `checkTransferList` (private to `RpcServer.ts`) runs only under
    `NODE_ENV === 'test'` and only for methods a test drives through `execute`;
    `executeMultiRowGetFeatures.ts` and `executeRenderWiggleData.ts` have no such
    test. That is the state `MultiWiggleGetScoreMatrix` was in until `2b51653d9c`
    found its list wrong in both directions — see `explainTransferError.ts`,
    whose header records it.

## The two that are Colin's

**Desktop `contextIsolation`.** The release-notes paragraph describing it as done
is out of the draft; the window is still `nodeIntegration: true,
contextIsolation: false, webSecurity: false` and `electron/preload.ts` says so in
its own header. The workstream is planned, not abandoned —
`reference/DESKTOP_CONTEXT_ISOLATION.md` holds the plan, the ordering and the
worker probe that gates the whole thing, and `ideas/plugin-main-process-bridge.md`
holds the crossing its step 2 is waiting on. This only records that the notes had
run ahead of it.

**The two-tier benchmark table.** Removed from the draft, marker left in place.
Nothing in-repo records that run — the only PIF measurement is
`measurements/pif-coarse-tier-bytes.json` (`hand`), holding on-disk size ratios
per block length rather than download bytes or time-to-settle. Its caption also
named a UCSC liftOver chain, and `ChainAdapter` declares no tiering slot while
`make-pif` takes PAF, so the run as described could not have produced those
numbers. Needs a measured pair or the paragraph stands without them.

## Checked and clean

Negative results, so they are not re-derived. Each was traced or run, not assumed.

- **Alignments** (163 commits, the largest area) — no confirmed correctness bug.
  The consensus port was reproduced against samtools 1.23.1 across all 50,000 bp
  of volvox ctgA in 2 kb windows: 0 differing positions, and exactly 1 under
  `-A`, at the position the test header documents. All 7 goldens regenerate
  byte-identically, so the `samtools consensus -a` frame trap did not land here.
- **The region-too-large gate** — no reachable oscillation: crossing the
  sub-floor only widens the budget, index estimates are monotone in span, and
  nothing sets `forceLoadTrack` back to false.
- **Comparative-adapters CIGAR arithmetic** — chain `blockLen` and its pad
  repair, the delta parser's single-base strand fix, the shared walk origin's
  reverse-strand anchor swap, and the coarse tier's per-piece apportionment.
- **The worker's compact encodings** — read-name block exact in both directions
  (BAM byte offsets coincide with code-unit offsets because latin1 is 1:1), the
  dictionary encoding's cardinality shortcut sound, `MAX_DEPTH = 4` covering the
  deepest payload exactly, and no transferred-but-still-owned buffer.
- **The re-export ABI machinery** — `abiPreviousRelease.test.ts` fails on an
  unlisted removal, against the published v4.3.0 tarball, with a third test
  rejecting stale entries both ways. `check-published-plugins.ts` run live
  reports 1 of 14 breaking (Apollo), as the notes say.
- **VCF breakends** — all four bracket orientations correct through `@gmod/vcf`;
  `sv-core/util.ts:104` and `Breakends.tsx:28` agree despite reading as
  opposite, because `tickX` negates its sign.
- **The classic-vs-ESM worker mismatch** — no instance in the tree.
