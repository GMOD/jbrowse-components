---
name: handoff-bam-stack-optimization
description: Live state of the BamAdapter x @gmod/bam x @gmod/bgzf-filehandle vertical-integration thread — which seam landed, which was measured out, which is untouched and holds the biggest number, and the four repo-state traps that cost a run each. The durable knowledge is filed elsewhere and linked from here.
---

# Handoff: the BAM stack, vertically

**Started** as "analyze BamAdapter, `@gmod/bam` and `@gmod/bgzf-filehandle` and
make sure we have vertically integrated optimizations." The audit found the
stack already deeply integrated, three seams open, and produced one landed perf
change, one negative result, and one item still untouched.

Everything durable is filed. This file holds only what is still live.

## Where the knowledge went

- **The audit itself** — every lever the two libraries expose, whether the
  adapter reaches it, the four non-integrations that are *deliberate*, and all
  three seams with their measurements →
  [reference/BAM_STACK_INTEGRATION.md](../reference/BAM_STACK_INTEGRATION.md)
- **The per-context ceiling, and why it is no longer a speed argument** →
  [reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md),
  §"Per-JS-context scoping multiplies by the RPC pool"
- **The pool is per RPC worker, not per session** →
  [reference/BGZF_WORKER_POOL.md](../reference/BGZF_WORKER_POOL.md)
- **What to do next, in order** → [TODO.md](../TODO.md), the inflate-pool entry
- **The 68-72% still on the table** → `@gmod/bam` ADR 0019, in that repo
- **What was done and when** → `git log`

## The three seams, and their disposition

| seam | state |
| ---- | ----- |
| 3 — reference read serial behind the alignment fetch | **fixed and verified.** 1.50x on a pan |
| 1 — inflate pool and byte cache duplicated per RPC worker | **measured out on speed.** Memory unweighed |
| 2 — `@gmod/bam` chunk cache key slides as a query pans | **untouched.** The biggest number in the audit |

**Seam 2 is where the number is.** 68-72% of decompressed bytes redundant on
shallow-to-moderate short-read data, `volvox` included — the file in front of
everyone who tries JBrowse for the first time. It is untouched because the fix
is a re-keying inside `@gmod/bam` plus a batch-fill path in
`@gmod/shared-read-cache`, and it lands on four of that repo's ADRs at once. Its
own author parked it with "expect to make this conditional rather than
universal." Read ADR 0019 before touching `chunkCacheKey` from either end — the
variant that looks like a small local fix silently returns duplicated reads.

## The one decision waiting

**Weigh the wasm memory, or close the inflate-pool item.** The speed premise it
was filed on is measured out (see the limits entry). What remains is 20
grow-only `WebAssembly.Memory` instances that nothing tears down, since nothing
calls `destroySharedWorkerPool`.

Closing it is a legitimate outcome and should not need permission: if the memory
does not matter, the duplication is untidy and free, and `BgzfWorkerPoolHost` /
`BgzfWorkerPoolClient` can go on being unused.

The measurement is not the usual one. **JS heap counters cannot see wasm
memory** — it is outside `Runtime.getHeapUsage`, so `memHelpers`' heap tooling
will report a flat floor and mean nothing by it. This wants process-level RSS
per target.

## Verified how, exactly

Worth separating, because two of the three seams turn on measurements that a
casual reading would take as stronger than they are.

- **Seam 3, verified twice and both ways round.** Ordering is asserted
  deterministically in `referencePrefetch.test.ts`; the timing is a browser A/B
  where the gate supplies both arms from one run. Trustworthy.
- **Seam 1, verified only at 4 cores, and only against noise.** Two builds of
  identical code differed by 15% — wider than every gap between arms — so the
  claim is "no arm beat the status quo", not a ratio. Do not quote a speedup
  from it in either direction.
- **Seam 1's memory half: not verified at all.** Nobody has measured it.

## Fixtures are regenerable, not committed

Everything under `test_data/jb2bench_link/` is gitignored and none of it
survives a worktree removal. Each probe's header carries its own recipe; the
pieces are `samtools view --remove-tag MD` (the repo's own BAMs and jb2bench's
all carry MD, so on them the reference is never fetched and half these questions
are invisible), `browser-tests/make-tiled-fixture.sh` for a reference bigger
than one 256 KiB chunk, and real copies plus hard links rather than symlinks —
the test server resolves realpath and 404s anything pointing outside its root.

The one committed fixture is `plugins/alignments/test_data/volvox-sorted-nomd.bam`,
which the unit test needs. Its `.bai` is force-added past the `*.bam.bai` ignore,
same as every other committed index here.

## Repo-state traps found on the way

None caused by this thread; each cost a run or a bad commit.

- **`pnpm autogen --check` writes before it diffs.** A `git add -A` after it
  swept unrelated regenerated `website/docs/models/*` into a commit whose
  message said it had left them alone. Check `git status` after running it.
- **A worktree older than a lockfile change lies about typecheck.** The
  `WorktreeCreate` hook installs at creation time, so after a dependency bump
  lands on `main` a rebased worktree still has the old package and reports
  errors that are already fixed. `pnpm install --frozen-lockfile` in the
  worktree. Cost a wrong "main is red" report here.
- **The primary checkout is not always on `main`.** Another agent had it on
  their own branch, so `git -C <primary> merge --ff-only` had no target and
  failed with "Not possible to fast-forward". Nothing is wrong; wait, or land
  later. Do not force `main` — the branch keeps the commits meanwhile.
- **A probe run races a concurrent build.** `pnpm build` wipes `build/` first,
  so a probe started against it dies mid-load. Wait for the build to finish
  rather than overlapping them.

Two smaller ones, both in the probes' headers rather than here: readiness is
`data-display-drawn` counted to N and **not** "zero loading overlays" (which is
true before anything mounts, so it returns instantly with no tracks open), and
counting bgzf pool workers needs a **recursive** `Target.setAutoAttach`, since a
pool worker is a worker inside a worker.

`taskset -c 0-3` is a working way to fake a low-core machine: Chrome reports the
affinity-limited count, so `hardwareConcurrency` really reads 4 and both the RPC
pool and the inflate pool size themselves down accordingly.
