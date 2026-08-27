---
name: display-uniformity-handoff
description: Mid-flight state of the 2026-08-27 display-uniformity pass — worktree `display-uniformity`, nine commits landed on the branch, five implementation agents' edits sitting UNCOMMITTED in that tree, and the landing steps left. Read before touching that worktree or re-auditing the fetch/chrome layer.
---

# Display uniformity pass — handoff (2026-08-27)

**Where:** worktree `.claude/worktrees/display-uniformity`, branch
`worktree-display-uniformity`, based on local `main` (`8cbbd81e27`). The
session ran out of tokens with agents still working; nothing has been merged.

## Committed on the branch (verified: display-kit + MultiWay + wiggle/gwas/gccontent suites green; docs checkers green)

1. `GlobalFetchMixin` gets `dataSuperseded` (folded into `dataCurrent`, gate is
   `signatureCurrent`) and `installGlobalFetchAutorun` installs the stored-hover
   clear — `MultiWaySyntenyDisplay` uses both (export gate over its lane
   fetches; click-after-zoom bug).
2. `ContextMenuMixin` / `DisplayContextMenu` moved to `@jbrowse/display-kit`
   (tree-sidebar re-exports).
3. `createAdapterMetadataFetch` (`@jbrowse/core/util/adapterMetadata`).
4. score-example `rpcDataMap` → `regionDataMap`.
5. Generators: chrome-adoption follows `@jbrowse/<pkg>/<subpath>`; hook table
   lists `dataSuperseded`. Docs corrected in ARCHITECTURE / DISPLAYCHROME /
   display-kit CLAUDE / `createStopTokenRotation` docstring.
6. wiggle host refactor (+ wiggle-core → display-kit dep, lockfile), Manhattan
   on `ContextMenuMixin`, GC content empty `regionFetchKey` + one
   `gcAdapterConfig`.

## UNCOMMITTED in the working tree — five agents were mid-edit

Each was told not to commit; their file sets are disjoint. `git status` shows
them. Do NOT `git checkout`/`reset` these paths. For each: read the agent's
report if it exists (`/tmp/claude-1001/.../tasks/*.output` is the transcript;
the final message is the report), else review the diff, run the suite, commit
by pathspec (`git commit -- <paths>`).

| agent | file set | what it was doing |
| --- | --- | --- |
| variants | `plugins/variants/src/{shared,LinearMultiSampleVariantDisplay,LinearMultiSampleVariantMatrixDisplay,LDDisplay}` | **bug:** `regionHasData` off the committed batched payload (stale `loadedRegions` wedge); LD `isLoadingOrCanceled` click; hit-test via `onPointerPosition`; `ContextMenuMixin`; `createAdapterMetadataFetch`; dead code |
| canvas | `plugins/canvas/src`, `plugins/variants/src/LinearVariantDisplay` | `ContextMenuMixin` in the base + derived highlight; `regionFetchKey` folds `showAminoAcids`; `conf` typing; shared `openCanvasFeatureDetails`; multi-row drops `CanvasFeatureGateMixin`; `colorLegendItems` fold; stale comments |
| alignments | `plugins/alignments/src/LinearAlignmentsDisplay`, `LGVSyntenyDisplay`, LGV `useSideScroll.ts`/`TracksContainer.tsx` | pan through `useSideScroll` (delete `startDocumentDrag`); hover inert while menu open + `hover.cancel()`; `scrollTop` volatile delete; `mismatchContrastMap` getter; `featureNoun`; dead members. **Open:** `plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md:131` names `groupClippedBy`, which the agent deleted — `check-doc-imports` is red until that line is fixed |
| hic/arc/seq/maf | `plugins/{hic,arc,sequence,maf}/src` | **bug:** arc `painted` gets `paintInert`; arc models/glyphs folded onto `ArcFetchModel`; arc hover published; sync fetch install; HiC legend via `FloatingLegend`, hit gated on `isLoadingOrCanceled`; sequence `trackMenuItems` super-chain; MAF pre-flight byte RPC → `byteLimit` in `LinearMafGetAnnotationData`; MAF `resizeHeight` delete; one `afterAttach`, `namedAutorun` |
| comparative | `packages/synteny-core/src`, `LinearSyntenyDisplay`, `LinearSyntenyViewHelper`, `plugins/{dotplot-view,circular-view,breakpoint-split-view}/src`, `SHARED_CANVAS_VIEWS.md` | `svgReady` into `comparativeFetchFlags`; synteny `adapterConfig` override delete; `useCoalescedPointer` in synteny + dotplot; chord `fanOutStatus`/`callRpc`; breakpoint `prepare` declines on `fetchInert`; synteny-core dead exports (ABI check per `PLUGIN_ABI_STABILITY.md`) |

## Landing steps

1. Collect/commit the five sets above. Then `pnpm typecheck` (first runs
   failed only on mid-edit files), `pnpm lint` + `pnpm lint:eslint`,
   `pnpm test-related`, and `pnpm autogen` (expect the config-doc churn
   `autogen-gate-reports-mains-staleness` describes — keep only what these
   changes explain; `scripts/chromeBundleSizes.json` may move for real since
   display-kit gained two modules).
2. `git rebase refs/heads/main` (`main` is ambiguous as a bare name in this
   checkout — use `refs/heads/main`), re-test, `ExitWorktree keep`, then from
   the primary checkout `git merge --ff-only worktree-display-uniformity`,
   `git worktree remove`, `git branch -d`.
3. Delete this handoff when it lands.

## Findings from the audit not assigned to anyone

- Alignments `regionHasData` sits on the default (canvas/multi-row/MAF override
  it as defense-in-depth) — a choice, noted for uniformity only.
- LD and HiC outer components read zoom-dependent geometry for the chrome
  `style`, re-rendering the chrome per zoom frame (matrix moved this into an
  observer child).
- `renderSvg` declared in `.views()` (HiC, sequence) vs `.actions()` (arc, MAF).
- Sequence's `rendersCanvas:false` placeholder is a MUI `Alert`, LD's a plain
  div — one display-ui component would serve both.
- Docs: ARCHITECTURE "installs four autoruns" is the generator counting
  `#autorun` tags (prose now says "plus the hover reaction"); the foundation
  table lists `LinearScoreDisplay` (example plugin) while the census excludes it.
