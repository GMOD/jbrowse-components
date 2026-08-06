# Handoff: the figure store, and what is still open

Figure **bytes** live in S3; git tracks `figures.lock`. Landed 2026-08-06 across
`e5af680b69` … `c78fbe091e`, all on `main`.

Background lives in the code, not here: `website/scripts/figure-store.ts` has
the design and the reasoning, `website/CLAUDE.md` has the rules. This file is
only what is **not finished**.

## Status: LIVE ✅

452 figures under `s3://jbrowse.org/jb2-figures/`, `website/static/img/` and
`products/jbrowse-img/img/` gitignored, 0 figure files tracked.

Verified, not assumed:

- Fresh shallow clone (124 MB `.git`, **0 figures**) → `figures pull` with
  credentials scrubbed and a fake `$HOME` → all 452 installed
  **byte-identical**. Cold pull is **3 s**.
- The WebP dimension parser cross-checked against ImageMagick over all 48
  committed `.webp` plus PNG samples — zero mismatches.
- `figures report` renders before/after from immutable store URLs; all 132 image
  URLs in a real sweep report returned 200.
- 14 unit tests (`figure-store.test.ts`), typecheck, oxlint, oxfmt all clean.

## Open items, in the order I would do them

### 1. Decide whether to adopt a CI-rendered baseline — this is the one that matters

The first sweep reported **66 figures moved**. Of those, **35 changed by ≤1 % in
bytes at identical dimensions** — measured with the repo's own gate at 0.652 %,
1.047 %, 1.322 % of pixels, i.e. barely over the 0.5 % threshold. That is
sub-pixel AA drift between wherever the committed figures were rendered (a dev
machine) and the runner, not app drift.

**The obvious objection — "that churn recurs every sweep" — was tested and is
wrong.** Two independent CI sweeps, comparing the bytes each produced:

```
changed vs committed baseline: run1=80 run2=82, in both=78
  run1 and run2 produced IDENTICAL bytes: 72
  run1 and run2 DIFFER (nondeterministic):  6
```

Run 2 confirms it from the other side: 68 manifest changes but only **10 blobs
to upload**, because 58 of its outputs already existed in the store from run 1.

So adopting is a **one-time** cost that turns "66 noisy changes every sweep"
into "6". Until someone does, every weekly report is ~35 entries of noise and
nobody will read it.

**Do not adopt blindly.** The other ~26 real changes and 5 resizes are what the
sweep exists to catch — the workflow header cites two regressions found this
way. Review those in `pnpm review-screenshots-web` first; the ≤1 % ones are
visually identical and safe.

### 2. Six genuinely nondeterministic specs

These differ between two CI runs of the same commit, so they churn every sweep
regardless of baseline:

```
alignments_sort_by_base
dog10k-cyp1a2-nonsense
multiway_synteny/ecoli_one_vs_all
pangenome/hprc_cfhr_deletion
pangenome/hprc_mhc_layout_anchored
pangenome/rgfa_strain_launch
```

Four are graph/synteny layouts, where force-directed placement and async block
ordering are plausible causes. `alignments_sort_by_base` is the one already
recorded as reading like "17 % render flakiness for months".

`pnpm screenshots --check --filter <name>` renders each twice in one run and
reports drift, which separates "nondeterministic in itself" from
"nondeterministic across machines" and so decides whether the fix is in the spec
or the app. **Do not just raise `diffThreshold`** — `image-pipeline.ts` is
explicit that a raised gate silently swallows real changes (a deliberate recolor
moves ~2.4 %).

### 3. The residual sweep failures are third-party, not code

The sweep went 38 → 35 failures once the build gaps were fixed (below), and the
remainder are hosts refusing under a 300-spec concurrent sweep. Every underlying
file was checked and is healthy — 206 with 0.23–0.45 s TTFB:

- `genomes_msa/launch_sequence`, `genomes_msa/pyrin_residues` — NCBI eutils 429s
  the burst, so the human protein record never returns and the `Pyrin_NALPs`
  gate fires. **That gate is working as designed**; `msa.ts` records that a
  looser one once shipped an overlay missing the block the figure is about.
- `gallery/fiberseq_gapdh` — "still pending after 121 s" on a `.bam.bai`.
- 4 × `cancer_sv` + `gallery/nanopore_methylation` — remote CRAMs against 90–120
  s ceilings. (A 5th, `cancer_sv/realigned_reads`, is only a cascade from its
  compose part.)

**Suggested fix: one retry pass over specs that failed on a network error.** The
sweep has no retry at all, so a single bad moment burns a figure for the week. I
raised this earlier, withdrew it when the list turned out to be dominated by
deterministic build gaps, and revive it now those are fixed. Verify against a
sweep before building it — if the same specs fail every run, retry won't help
and the answer is `heavyNetwork` or higher ceilings instead.

### 4. Nothing adopts the sweep's `figures.lock` automatically

`figures.yml` publishes blobs (`figures:push`) and uploads `figures.lock` as an
**artifact**. It runs `contents: read` with `persist-credentials: false`, so it
cannot commit. Until that changes, a regen needs the lock committed by hand or
the site keeps serving the old hashes. Deliberate — a sweep with failures should
not self-merge — but it means the artifact must actually be picked up.

### 5. `figures mirror` is unwired

`pnpm figures mirror --dest s3://<bucket>/jb2-figures` exists and is add-only by
construction (a sync without `--delete` against a content-addressed store cannot
propagate a deletion). It is not in any workflow because that needs a
destination bucket nobody has picked. The current set is not at risk — `push`
rebuilds the whole store from any checkout in ~25 s — but _superseded_ revisions
are single-copy, and those are what `report`'s before-column reads.

Bucket versioning is **not** the answer for figures: keys are content-addressed
and never overwritten, so it would only add deletion cover. It would matter for
`demos/`, which is written by path.

## What was already fixed here, so it is not re-litigated

The first five runs of `figures.yml` (it landed 2026-08-05; no scheduled run has
fired yet, so every run so far is manual) exposed:

- **`pnpm build:esm` did not compile.** `HeightModeMixin.ts` read
  `process.env.NODE_ENV` without the `declare const process` its three siblings
  carry. Nothing caught it: `pnpm typecheck` is `tsc --noEmit` over a different
  config, and no CI job ran `build:esm`. Locally it hid behind a stale `esm/`.
- The sweep needed that build (jb2export resolves `@jbrowse/core/x` →
  `packages/core/esm/x.js`), the **embedded UMD bundle**, and **`librsvg2-bin`**
  for `rsvg-convert`. Each masked the next, so they surfaced one sweep at a
  time. **The `rsvg-convert` half is not yet confirmed** — the ESM and UMD fixes
  are (wheat and `embed_linear_genome_view/final` both pass), but `librsvg2-bin`
  landed in `c78fbe091e` and the sweep verifying it was still running when this
  was written. If the 26 `jb2export` specs still fail, read the new error rather
  than assuming: each of these fixes revealed the next.
- `orthofinder_synteny/wheat` got a 300 s ceiling — 6 assemblies × a 106,156-row
  orthogroup table is ~500k ribbons and the runner has no GPU. Its two lighter
  siblings pass at 120 s. Confirmed fixed.
- The `Figures moved` job compared against `origin/main`, which by job time _is_
  the commit under test — it reported "0 changes" for the commit that introduced
  all 452 figures. Now `github.event.before`.
- `figures pull` refused to replace figures left by a different checkout,
  treating them as local work, so `pnpm build` published another commit's
  figures. Now it asks the store: bytes that are published are safe to replace,
  bytes that are not are kept and named.

## Traps

- **Never hand-write a store URL** — content-addressed, so it goes stale on the
  next regen. The jbrowse-img README is the one exception and its URLs are
  _generated_ by `sync-img-readme.ts` from `figures.lock`, gated by
  `autogen --check`.
- **`https://jbrowse.org/jb2/…` is months stale.** Deploys go to `/jb2-staging`,
  and the `update docs` trigger appears in 0 of the last 400 commits.
  `/jb2/img/hic/…`, `/jb2/img/pangenome/…` and `/jb2/img/jbrowse-img/…` all 301
  → 404. `curl` before pointing anything durable at a `/jb2` asset. The deploy
  gate reads `github.event.head_commit.message`, i.e. the **tip** commit of a
  push only.
- **Nothing is ever deleted from the store**, including orphans. A store URL is
  a public link. There is deliberately no `gc`.
- **An unpushed regen is invisible to git**, and CI cannot catch it — the
  evidence is a file on one disk. `generate-screenshots` ends on
  `NOT IN THE FIGURE STORE` and `review-screenshots-web` banners it; both scan
  the whole worktree, not just that run.
