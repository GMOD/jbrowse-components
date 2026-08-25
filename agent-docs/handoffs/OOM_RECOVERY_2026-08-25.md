---
name: oom-recovery-2026-08-25
description: A multi-agent run on 2026-08-25 died to an out-of-memory kill around 11:40. Nothing was lost — seven branches hold 21 unlanded commits across six live worktrees, and the four worktrees that still held uncommitted work at the crash are committed in place. This is the index of those threads, what each is waiting on, which seven worktrees are safe to remove, and the three checks the run left red on main (fixed here). Delete once the seven branches have landed or been declined.
---

# The 2026-08-25 out-of-memory run: what survived, and where

An agent fleet was landing work all morning — main took 33 fast-forward merges
between 09:36 and 11:50 — and the machine OOM-killed it. The last merge into
main is `db6f7a785e` at 11:50; the newest orphaned commit is `a079af0254` at
11:38.

**Nothing was lost.** Every thread had committed to its own branch, and the four
worktrees that still held uncommitted files were committed in place on
2026-08-25 by this recovery pass (the four commits below marked **[recovered]**;
each says in its message what was and was not verified, so `git reset --soft
HEAD~1` gets any of them back to a working copy). `git fsck` finds no dangling
commit newer than the run. No `git stash` entry belongs to it — the three on the
stack predate it.

Read this file for the map, then the per-thread handoff or the branch's own
commit messages, which are long and carry the measurements.

## The seven live branches

Every one is **behind main by 11–17 commits**, so each starts with `git rebase
main`. Landing is `git rebase main` in the worktree, `ExitWorktree keep`, then
`git merge --ff-only <branch>` from the primary checkout — `git -C` at the
primary is refused from inside a worktree session.

| branch | worktree | commits | state |
| --- | --- | --- | --- |
| `worktree-agent-acfeb70cb2f804a37` | `agent-acfeb70cb2f804a37` | 5 | **Ready.** Has its own handoff — read it first. |
| `worktree-agent-a5b4d56fcbb29711f` | `agent-a5b4d56fcbb29711f` | 3 | **Ready**, unverified since the crash. |
| `worktree-agent-aa4a46b1e687bd163` | `agent-aa4a46b1e687bd163` | 5 | 4 verified, 1 **[recovered]** unverified. |
| `worktree-agent-a1a715ae94bb69fe8` | `agent-a1a715ae94bb69fe8` | 3 | 2 verified, 1 **[recovered]** part-verified. |
| `abi-exports-map-and-adr-091-record` | `agent-a1a83249689617c96` | 2 | 1 verified, 1 **[recovered]** unverified. |
| `worktree-region-too-large-cite` | `region-too-large-cite` | 1 | **Ready.** One-line doc fix. |
| `synteny-roundtrip-tours` | none | 5 | Blocked on filming. Has its own handoff. |

Plus `wip-capture-stability` (`ab3d2d3bce`), which is **parked on purpose** — see
below. It has no worktree.

## sv-core breakend audit — read its own handoff first

`worktree-agent-acfeb70cb2f804a37`, whose `agent-docs/handoffs/` gains
`sv-core-breakend-audit-remainder` when it lands. The most finished thread here,
and the only
one whose agent wrote a handoff. That file was itself uncommitted at the crash
and would have died with a `git worktree remove`; it is now `6d960a46be`.

```
6d960a46be docs(handoffs): the sv-core breakend audit's remaining three findings   [recovered]
d2f00b09d9 docs(sv-core): the two keeps-directions read their strings with opposite polarity
b75ecc286b fix(sv-core): a junction may come from a paired record, not only an ALT
e02fe752d3 fix(breakpoint-split-view): a reciprocal BND pair may spell one contig two ways
42dbac0925 fix(bed): a STAR-Fusion breakpoint's refName may contain colons
```

Three findings fixed and revert-checked, green at the tip across six plugins
(1,306 tests) plus `typecheck`, `lint`, `check-format`, `check-docs` and
`build:esm`. The remaining work is one out-of-scope line in
`plugins/spreadsheet-view/src/SpreadsheetView/SpreadsheetModel.tsx:236-241` —
the handoff explains why that is the only place the outward breakend walk is
fully fixable.

**A 237-file `website/docs` diff sat dirty in this worktree and this pass
discarded it.** It was one `pnpm autogen` run's unformatted output — `*read*`
where the tree has `_read_`, unwrapped long lines — the noise
`generated-docs-unformatted-noise` describes, not work. Regenerate after the
rebase.

## Multi-way synteny — three fixes, no handoff

`worktree-agent-a5b4d56fcbb29711f`, tree clean since before the crash.

```
18655756d2 fix(multiway): two disjoint hits in one lane draw as two blocks
191a6aa8e2 fix(multiway): a reverse-strand block twists its ribbon
7b161ade6a fix(multiway): a lane matches assembly and refNames through the aliases
```

All three are wrong-picture bugs rather than errors: a duplicated gene drew one
solid block across 280px of sequence aligning to nothing; an inversion drew the
untwisted parallelogram a forward block draws; and two `===` comparisons the
Names rules forbid meant a lane declared against an alias found no gene track and
an assembly whose annotation uses accessions drew no genes at all. It adds two
integration suites in `products/jbrowse-web/src/tests/` and four fixtures under
`test_data/multiway_blocks/`. The commit messages carry the measurements. Nobody
re-ran the suites after the crash.

## Test pins and one lint ratchet

`worktree-agent-aa4a46b1e687bd163`. Four commits pinning behaviour that had no
coverage — each says which sabotage the existing suites let through, and each
was checked under `NO_RC=1`, which is the run that sees a memoization sabotage.

```
479a973903 lint: a worker payload does not go to a React prop                      [recovered]
a079af0254 test: pin the wheel to the tracks area, not the whole view
b4ddd5a29f test: pin LD's hover gate to isLoadingOrCanceled
584cd2caad test: pin the density half of the gate's tier guard
04a2c7ab0e test: pin lazyChunk's retry and the synteny clamp's sameScale guard
```

The recovered commit adds `noPayloadThroughAProp` to `eslint.config.mjs`,
holding the field cleared by `4f1f661868` (already on main): React 19.2's
dev-only performance track walks a changed prop to diff it, and
`Object.prototype.toString` puts a typed array on neither the Array nor the
plain-object path, so react-dom enumerates it with `for...in` — one property row
per element, uncapped, for the old value and the new both. Hic's tooltip took
`data={rpcData}` and one pan under the cursor cost 6.8s and ~1GB. **The rule
matches zero sites repo-wide right now**, so it is a ratchet, not a backlog —
but `pnpm lint` has not run with it in place.

## The LD display — three commits, the third a new GPU detector

`worktree-agent-a1a715ae94bb69fe8`.

```
969862e0d0 feat(variants): a GPU LD matrix its CPU twin disagrees with goes to the CPU  [recovered]
702b4e46bc fix(variants): the LD display says what it measured, not what it assumed
5847a213c9 fix(variants): a reordered LD cell nothing computed is no longer drawn as 0
```

The recovered commit is the substantial one and is the piece most worth not
re-deriving. **A WebGPU dispatch that comes back incomplete raises nothing** —
it is valid, it is submitted, `mapAsync` resolves, and the cells whose
workgroups never ran read back as the zeros the buffer was created with, which
is a plausible LD matrix. `pushErrorScope('validation')` cannot see it. Landed
commit `3f4c3f6ee4` (bit-planing the composite kernel) made it stop happening on
one Radeon Pro 5300M without adding a detector, so a slower GPU or a larger `n`
trips it again silently. `ldGpuSpotCheck.ts` recomputes about a dozen cells on
the CPU after the readback — weighted to the end of the flat order, where a
truncated dispatch leaves its hole — and throws past `1e-3`, a tolerance chosen
to sit between the legitimate f32-vs-f64 gap (2.8e-8 to 6.0e-7 measured) and the
smallest truncation disagreement (1.2e-2).

It also moves `planDispatch` to `ldDispatchPlan.ts` as `planLDDispatch` and makes
it weigh the genotype *input* buffer, not only the output. The input reached the
device unchecked before and survived only by an accident of ordering:
`createBuffer` runs outside `runGPUCompute`'s error scope, so what the scope
actually caught was the later `setBindGroup` against an already-invalid handle.

**Verified in this pass:** `planLDDispatch.test.ts` and `ldGpuSpotCheck.test.ts`,
14 tests, both green. **Unrun:** typecheck, lint, and the rest of
`plugins/variants`. `agent-docs/reference/ARCHITECTURAL_LIMITS.md` is rewritten
to match and quotes four new ceiling figures the test file holds.

## The exports-map gate, and ADR-091's lost measurements

`abi-exports-map-and-adr-091-record`.

```
3d6d5d9e65 docs(adr-091): re-derive the eager closure, and mark what only the lost branch saw  [recovered]
d480274040 feat(core): gate the published exports map against the last release
```

`d480274040` closes a hole where `@jbrowse/core`'s `exports` map — derived by
grepping the repo for `@jbrowse/core` import specifiers — silently un-publishes a
subpath when its last in-repo importer goes away, as
`configuration/configurationSlot` did on 2026-08-24. It is directional rather
than a snapshot (211 entries would cry wolf), extends the scan to
`example-plugins`, and seeds `SUBPATH_REMOVALS` with the 16 subpaths that
already left unrecorded. Sabotage stated in the message.

The recovered commit answers a separate question worth knowing about: **ADR-091
cites a branch that does not exist.** It named `worktree-manhattan-lazy-spike`
(29 commits) as "the record" for its measurements; `git for-each-ref` finds no
branch, remote or tag, and `agent-docs/measurements/` had no entry. Every figure
taken there is now marked **branch-only** in the ADR. The one a reader can
check is the eager import closure, because both arms landed:
the branch's new `eager-import-closure` script walks a module's eager
first-party static-import closure at a commit, with `--minus` to subtract the
other arm, and
`defineDisplay` against Manhattan's hand-composed factory at `f0d8cf4e39` — the
last commit with `defineDisplay` alive — comes to **34 modules and 216,947
source bytes**, against the ADR's branch-taken 40 / ~240 KB.

No check has run on it. It also gives `score-example`'s display the
`#stateModel` JSDoc it never had, which adds a row to
`website/scripts/api-docs/coverage-gaps.txt` — confirm that ratchet still
passes.

## Ready to land as-is

`worktree-region-too-large-cite`, one commit `651b73e579`: the display-ui page
and `DisplayUIProvider`'s docstring mentioned `DISPLAYCHROME.md` as a backticked
path, which the citation check does not read as a citation. Now a link. This is
the smallest thing here and clears nothing red on its own.

## Parked on purpose — do not resume without new evidence

`wip-capture-stability` (`ab3d2d3bce`), no worktree. It shoots the targeted
canvas until two consecutive frames agree byte-for-byte. **The theory is
supported and the fix is not**: drift counts were 1/45 control, 0/60 and 0/60
with stability, 1/60 targeted-only — and stabilizing the *fullpage* capture
cannot affect the targeted number, since `dualSnapshot` shoots targeted first
and the backends run in separate browsers. At a ~1-in-30 base rate, P(0 in 60)
is about 0.14, so two clean sweeps is weak evidence. Two by-products worth
keeping are already in the message: holding an element handle across shots hits
`Node is detached from document` (4 of 60 runs), and pixel stability is the wrong
stopping rule for `pageSnapshot`, which stopped each backend at a different
moment and swung `fullpage_alignments-bam` from 0.00% to 7.54% cross-backend.

## Three checks were red on main, and this commit clears them

Main at `db6f7a785e` failed `pnpm check-docs` on two of its 60-odd checks, and
`pnpm autogen` refused to write a third file outright. None of it belongs to any
branch above; all three are the run's own litter, and all three are fixed here.

1. **`pnpm autogen` refused to regenerate the doc indexes.** `handoffs/rna.md`
   was swept into `db6f7a785e` — the last commit before the crash — as a bare
   paragraph with no frontmatter, and `generate-doc-indexes.ts` throws rather
   than writing an index that would not list it. So **every** generated index in
   `agent-docs/` was frozen on main, not just the handoffs one. The file is now
   `rnaseq-deferred-items.md` with a `name:` and a `description:`, and its
   content is broken out into the two lists it was one sentence of.
2. **`the backlog index matches the backlog`** — an untracked `graph.md` sat in
   the todo directory of the primary checkout holding one line, "Tsc errors in
   graphgenomeview plugin", with no frontmatter and no row in
   `agent-docs/TODO.md`. This pass deleted the file; the finding it recorded is
   real and is in the next section.
3. **`no link duplicates its target title`** —
   `website/docs/user_guides/linear_synteny_view.md:100` wrote `[MAF
   track](/docs/user_guides/maf_track)`, duplicating the target's own title.
   From `40e3f5769a` (synteny-launch); `bc04116182` was pushed with
   `SKIP_DOCS_CHECK=1` because of it. Now the empty-text form the rest of the
   guides use, which renders the same words. This was open item 1 of the
   derivative-allele thread's handoff, which is closed out and deleted — the
   lineage question it also held is answered in
   [reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md), "Give a
   pluggable element an `extendsType`".

## The graph plugin's tsc errors, and its three unpushed commits

The note the stray file was pointing at checks out, and the plugin is
**out of tree** — `~/src/jb2plugins/jbrowse-plugin-graphgenomeview`, which is why
nothing in this repo's `typecheck` sees it.

`npx tsc --noEmit` there (typescript 7.0.2) gives **26 errors**: 7 in
`src/GraphGenomeView/model.ts`, 4 each in `RgfaTabixAdapter.ts` and
`MinigraphBubbleAdapter.ts`, 2 in `GetSubgraph.ts`, one each in six more files —
and **2 that surface inside jbrowse-components**:

- `packages/core/src/rpc/RpcRegistry.ts:311` — TS2344,
  `Type '"GetSubgraph"' is not assignable to type 'never'` on
  `EntriesDeclaringCallLevelFields`. This is the shape
  `orphan-rpc-augmentation-passes-alone` describes: the plugin's RPC method
  augments the registry without declaring its call-level fields, and only a
  build that includes both projects sees it.
- `packages/render-core/src/hal/mockHal.ts:135` — TS6133, an unused `binding`.
  Ours, trivially.

Most of the plugin's own errors are one root cause repeated: an adapter's
`config` is typed as its `ConfigurationSchemaType<…>` where
`BaseFeatureDataAdapter` wants the *instance* type, so `this` will not pass as
its own adapter. Fixing the two adapters' config type is likely to clear a dozen
of the 26.

That repository also has **three unpushed commits**, HEAD `76c3904`:

```
76c3904 fix(launch): "Open in <assembly>" scrolls a synteny row the graph was launched from
09df506 build: match core's @jbrowse/mobx-state-tree, so betabuild's typecheck gate passes
3ea526b fix(graph): a row layout's deletion bow is capped, so a big one stops enclosing the drawing
```

`76c3904` is the "row-aware `connectedViewId` fix"
[synteny-roundtrip-tours](SYNTENY_ROUNDTRIP_TOURS.md) lists as its second item.

## Housekeeping: seven worktrees to remove

Seven of the thirteen worktrees are clean and sit at a commit main already has,
so `git worktree remove` and `git branch -d` cost nothing:

- `capture-stability` (at `4575e15149`) and `lineage-aware-extension` (at
  `12dca1e3e1`) — both landed.
- `agent-a1efb1bc0c007ecd5`, `agent-a38d9d84a50b61423`,
  `agent-a6da965c6ea370080`, `agent-a7431533ccc4810b3`,
  `agent-acf5a9c07fa08c6db` — five subagent worktrees created together at 09:36,
  all still at `e8ca8633ef`, all clean, with file mtimes stopping between 09:49
  and 09:54. They committed nothing and left nothing dirty, so nothing is
  recoverable from them and nothing is lost. If a fleet gets re-run, five
  worktrees that produce no commit in 18 minutes is the shape to watch for.

## Suggested order

1. `worktree-region-too-large-cite` — one line, nothing depends on it.
2. `worktree-agent-acfeb70cb2f804a37` — verified green, has its handoff, and its
   remainder unblocks the SV inspector line.
3. Fix the two red check-docs items — item 1 is one character's worth of edit.
4. `worktree-agent-a5b4d56fcbb29711f`, then
   `worktree-agent-aa4a46b1e687bd163` — run the suites first; both are behind
   main and neither was re-checked after the crash.
5. `worktree-agent-a1a715ae94bb69fe8` — the two committed fixes were verified;
   the recovered detector needs typecheck, lint and the rest of
   `plugins/variants`.
6. `abi-exports-map-and-adr-091-record` — its recovered half is documentation
   with a generated measurement block, so `pnpm autogen --check` and
   `check-docs` are what matter.
7. The graph plugin, separately, in its own repository.

Land these one at a time as fast-forwards. Parallel landings from separate
worktrees is what the run above was doing when it died.
