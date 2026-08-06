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

### 1. Baseline drift — DECIDED, no action

**Settled: let the threshold gate update baselines as sweeps land.** No one-time
adoption step. The rest of this section is why that is safe, and is kept only so
the measurement is not re-derived.

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

So the drift is a **one-time** re-baselining that the gate performs by itself
the first time each figure exceeds its threshold, after which CI agrees with CI
and only the six below keep moving. Nothing to decide.

What still needs a person is the other side of the same sweep: the ~26 real
changes and 5 resizes are what the sweep exists to catch — the workflow header
cites two regressions found exactly this way. Review those in
`pnpm review-screenshots-web`, which now flags render failures and
nondeterminism per card.

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

**Do not run that check on a busy machine.** CPU starvation is itself timing
variance, so a contended run reports specs as flaky that are fine — the result
is worse than no result. Check `uptime` against `nproc` first, and that nothing
else holds port 3334 (a concurrent sweep both takes the port and competes for
the cores). This was attempted here and abandoned for exactly that: load average
27.77 on 16 cores with another sweep already running.

### 3. Confirm the raised CRAM ceilings landed

Six failures survived the build fixes, and they split cleanly once measured
across four sweeps.

**Transient, and they cleared on their own** — `gallery/fiberseq_gapdh` and both
`genomes_msa` specs passed in run 5. The msa ones are NCBI eutils answering the
burst with 429, so the human protein record never returns and the `Pyrin_NALPs`
gate fires; **that gate is working as designed** — `msa.ts` records that a
looser one once shipped an overlay missing the block the figure is about.

**Deterministic, and fixed in `cc1ce1adf9`** — the other five failed 4 of 4
sweeps, not under load. All gate on a CRAM pileup, and every file they need
answers in under half a second (206, 0.23–0.45 s TTFB), so the ceiling was
decode-and-draw on a GPU-less runner, not the network. Same diagnosis and
symptom as wheat, which passed the moment it had 300 s:

```
gallery/nanopore_methylation           90000 -> 300000
cancer_sv/realigned_reads_reference   120000 -> 300000
cancer_sv/split_view_from_breakend     90000 -> 300000
cancer_sv/multihop_split_view_steps    60000 -> 180000  (staged waitForSelector)
cancer_sv/derivative_autogenerated     60000 -> 180000  (staged waitForSelector)
```

**Still unverified**: a GitHub Actions partial outage killed the two sweeps that
would have confirmed it (one cancelled mid-render, one dead in `Set up job` with
`Service Unavailable`). Re-run the sweep. Expect 0 failures —
`cancer_sv/realigned_reads` is only a compose cascade and should clear with its
part. If they still fail at 300 s the ceiling was the wrong diagnosis, and the
question becomes what is specific about CRAM decode on that runner.

A retry pass over network-failed specs was considered and **not** built: with
the build gaps closed, the residue is either transient enough to clear by itself
or deterministic enough that retrying cannot help.

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
  for `rsvg-convert`. Each masked the next, so they surfaced one sweep at a time
  — the pattern to expect if more turn up. Read the new error rather than
  assuming the last fix was the last layer.

All three confirmed by sweep:

```
run 1:  284 succeeded, 38 failed
run 4:  287 succeeded, 35 failed   ESM + UMD (wheat and embed cleared)
run 5:  316 succeeded,  6 failed   rsvg-convert (0 jb2export failures left)
```

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
- **`review-screenshots-web` was still diffing the tree.** Its baseline was
  `git ls-tree`/`git diff`/`git show` over `website/static/img`, which after the
  move match nothing — so all 314 cards read "new", none read "changed", the
  `Changed vs main` tab selected everything, and the entire origin/main column
  said "not on origin/main". The failure is silent in the worst way: a git
  command asked about an untracked path answers "no such figure", which is
  indistinguishable from "unchanged". Now it reads `figures.lock` at
  `origin/main` and renders the before-image from the store URL that line names
  — no `git show` per image, and the link is one a reviewer can paste anywhere.
- **The same failure had a second door, and the page now names its baseline.**
  No `figures.lock` at the ref — a fork with no `origin`, a shallow clone, a ref
  never fetched — produced an empty baseline, and an empty baseline draws all
  316 cards "new" exactly like the tree-diffing bug did. `getBaselineState`
  keeps "no baseline" apart from "a baseline naming nothing" and banners it. It
  also names the commit and its age, because a remote-tracking ref is only as
  fresh as the last fetch: an unfetched checkout compares against a week-old
  main that still calls itself main, and nothing on the page said so.
- **The card/baseline join is now pinned by tests.** `figurePath` and
  `compareToBaseline` moved into `figure-store.ts` — the jest-parseable half,
  since `figure-paths.ts` has `import.meta` — so the four states a card can be
  in (unchanged, regenerated, added, unpulled) are checked without git or a
  worktree. The fixtures are keyed by literal `website/static/img/…` paths and
  **not** by `figurePath()`: fixtures built from the function under test agree
  with themselves no matter what it returns, which is the same self-agreement
  that let the git baseline look healthy while matching nothing. Breaking the
  join key fails all six.

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
