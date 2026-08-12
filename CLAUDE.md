# CLAUDE.md

Data is fetched in RPC workers, rendered on the main thread (WebGPU, with WebGL
and Canvas2D fallbacks). Worker output is **absolute genomic uint32** — no
regionStart-relative arithmetic crosses the worker boundary.

Background lives in `agent-docs/` (start at `ARCHITECTURE.md`, then `reference/`
and the ADRs).

## Git and worktrees

Work in a worktree (`EnterWorktree`), branched from `main`. It is your own
checkout, so ordinary git is yours to use without asking.

- **Commit as you go, without being told.** Every coherent step — a fix, a
  passing test, a doc — is a commit. Don't accumulate a session's work in the
  working tree waiting for permission.
- **Rebase onto `main` frequently.** A worktree that tracks main is a worktree
  that lands as a fast-forward.
- **Land with `git -C ~/src/jbrowse-components merge --ff-only <branch>`.** Main
  lives in the primary checkout, so the merge runs there. It fast-forwards even
  when that checkout is dirty, _unless_ the merge would overwrite one of its
  modified files — then it refuses and changes nothing. On a refusal, rebase and
  retry; never `git update-ref` main or force the merge. The two things that
  look like shortcuts are both worse: `git push . HEAD:main` just refuses here
  (`receive.denyCurrentBranch` is unset), and `update-ref` on a checked-out
  dirty `main` desynchronises its index from its worktree.
- **Land small and often** rather than saving a branch up. The longer a branch
  runs, the more likely a fast-forward stops being possible.
- **Don't push to `origin` (GMOD/jbrowse-components) or open a PR unless
  asked.** Local commits and local merges are yours; publishing is not.
- The primary checkout is shared with other agents and usually carries
  uncommitted work. Keep it clean when you can — continuous landing only works
  while main's checkout can fast-forward. If you must work there directly, use
  the shared-checkout rules in `~/.claude/CLAUDE.md`.
- **Never merge a `*.generated.ts` conflict — regenerate it.** Take either side,
  re-run the generator (see Tooling), `git add`. Only the sources conflict for
  real.
- **A worktree from `EnterWorktree` arrives installed.** The `WorktreeCreate`
  hook (`.claude/hooks/setup-worktree.sh`) creates it off local `main` and runs
  `pnpm install --frozen-lockfile` before the session starts — ~20s with a warm
  store — so `node_modules`, the per-package `@jbrowse/*` links, and everything
  `postinstall` generates are already there. That includes
  `products/jbrowse-web/src/buildInfo.ts`, which is gitignored and which `tsc`
  dies on when absent, taking ~5 suites with it (anything reaching `rootModel`).
  A worktree you made yourself with `git worktree add` gets none of this: run
  the install by hand there.

- **Figures are the one thing the install does not bring.** `website/static/img`
  is a gitignored corpus, so anything reading figures sees an empty one — and
  every `website/scripts/*.ts` needs `puppeteer`, which is not hoisted to the
  root, so resolve it from `packages/browser-test-utils/`
  (`createRequire(<that>/package.json)`) or run from a package that depends on
  it. **Two** corpora, not one — `products/jbrowse-img/img` is separate and just
  as gitignored:

  ```
  ln -s ~/src/jbrowse-components/website/static/img website/static/img
  ln -s ~/src/jbrowse-components/products/jbrowse-img/img products/jbrowse-img/img
  ```

  Those links are what let figure tooling see the machine's real figures,
  unpushed regens included, which is the whole point of a before/after
  comparison. They are gitignored and can be left in place — but that is a
  recent repair, and it is worth knowing what it repaired: the two ignore
  entries used to end in `/`, which matches directories only, so the links
  themselves were **not** ignored and a `git add -A` committed an absolute
  `/home/<user>/src/...` path over the figure directory. If a checkout ever
  arrives with `website/static/img` a dangling link, that is what happened.

  Miss the second one and `pnpm autogen` **dies** on the jbrowse-img doc
  generator (`README references /img/jbrowse-img/1.png but … does not exist`)
  rather than reporting it stale, so every generator after it in the run never
  executes and the report you get is short by however many those are.
  `pnpm figures:pull` is the other way to get both, and is what CI does.

- **Never symlink `node_modules` from the primary checkout.** This section used
  to recommend it, before the install was automatic, and it is a trap worth
  knowing because the damage is silent. Each package's `node_modules/@jbrowse/*`
  link is **relative**
  (`plugins/canvas/node_modules/@jbrowse/core -> ../../../../packages/core`), so
  borrowing the primary's tree makes every cross-package import resolve to the
  primary checkout's sources instead of yours. A test importing `./Thing.tsx`
  then sees your edit while a test importing `@jbrowse/some-core` does not — the
  same edit, tested twice, disagreeing, and the package-level one failing
  locally while passing in CI, or the reverse. A whole-repo `--noEmit`
  typechecks _its_ code against your edit and passes, which is a clean run that
  proved nothing. It is not a stale cache; don't chase it as one. A real install
  resolves those links inside the worktree and none of this arises.

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a slot or
  prop encodes a sentinel (`rowHeight === 0` = fit-to-height — a config slot,
  read through a raw same-named getter, on the displays that make it a setting),
  expose the resolved value under a distinct getter every consumer reads
  (`effectiveRowHeight`).
- Write config with `setConf`, not `configuration.setSlot`. Promotable slots
  resolve only through `resolveConf`, never `getConf`.
- In React, `autorun` inside `useEffect` to track observables (prefer over
  `reaction`).
- **An `autorun` must do its own reads. MST actions run untracked**, so
  factoring the body of one into an action — the obvious way to share it with a
  menu item or a flush-on-teardown path — leaves the autorun with no
  dependencies: it fires exactly once and then never again, silently. Same trap
  for the argument order `self.someAction(getSnapshot(self))`, which works only
  because the snapshot is taken before the action is entered. Duplicate the
  reads instead and say why.
- **Export a model's instance type as `interface X extends Instance<…> {}`**,
  not `type X = Instance<…>`. A view naming its displays and a display naming
  its view is an ordinary pair of getters and a mutual type reference; only the
  interface form defers it. As aliases the pair collapses — TS7023 on the
  factory, TS2456 on the type, then ~20 implicit-any errors in unrelated files,
  which is what you'll actually see first. Don't route around it by duck-typing
  the view. ADR-055.
- A duck-typed `interface XSelf` extends **`IStateTreeNode`**, never
  `IAnyStateTreeNode` — the latter resolves through `STNValue<any, …>` to `any`,
  so extending it silently turns off checking for every member you just
  declared. `IStateTreeNode` carries the same node-ness (still assignable to
  every `getSession`/`addDisposer`-style helper) and keeps the shape checked.

## React Compiler × MobX

`babel-plugin-react-compiler` does not compile inline `observer(function(){})` /
`observer(()=>…)` — always write observers that way. The
`function F(){}; observer(F)` form does get compiled and can stale a MobX read.

## Reference names: one normalization layer, and everything goes through it

**Any reading of user-supplied refName text resolves through
`getCanonicalRefName`, or it silently disagrees with the readings that do.**
That method is the normalization layer, and it does two jobs at once —
`refNameAliases[n] || lowerCaseRefNameAliases[n.toLowerCase()]` — so it resolves
aliases _and_ casing. Code that tests `region.refName` directly gets neither.

The failure is always the same and is always silent: an exact name works, a
pattern over the same names returns nothing, and **nothing distinguishes that
from "this assembly has no such contigs"** — so it reads as the feature being
broken or the data being absent, and no error is raised for anyone to act on.
Three instances of it landed in one session, all in glob matching of
`displayedRegionNames`: the glob tested canonical names while the exact entry
resolved aliases; then the glob was case-sensitive while the exact entry was
not; then the search box's picker matched `regions` while `searchRefNames`, in
the same dropdown, had always matched `allRefNames`.

So, concretely, for anything matching refName text:

- **Match over `allRefNames`, not `regions`.** `buildRefNameMaps` identity-maps
  every region into `refNameAliases`, so `allRefNames` is a strict superset of
  the canonical names and matching over it loses nothing.
- **Resolve hits to canonical, then emit by walking `regions`.** That two-pass
  shape is what keeps assembly order instead of alias-file order, and dedupes
  the ordinary case of several names for one contig.
- **Case-insensitivity is the regex's `i` flag, not a wider list.**
  `allRefNames` deliberately excludes `lowerCaseRefNameAliases` so it stays
  normal-cased; its getter says so.

`selectNamedRegions.ts` holds the only two readings of `*` — the resolver a
session spec goes through and `matchRefNames`, which the search box's dropdown
and its enter key share — and `globToRegExp` is module-private to keep it that
way. A third reading growing elsewhere is how the above starts over.

## Tooling

- Avoid running tests frequently, they are slow. Use `pnpm test <directory>`,
  not the full suite. Lint with `--fix`.
- **A full-suite run from the shared primary checkout also _lies_**, which is
  the reason the rule above matters more than the runtime does: other agents
  edit the tree mid-run, so a different unrelated suite fails each time and none
  of it is about your change. Judge your own change by a scoped run, in your own
  worktree.
- **`pnpm format <paths>` — pass paths.** Bare `pnpm format` rewrites all ~5800
  files. In your own worktree that is merely an unreviewable diff that will
  never fast-forward onto main; in the shared primary checkout it also lands
  another agent's reformatting under your commit message. The path argument used
  to be silently ignored (`oxfmt .` hardcoded the dot and the argument fell
  through to the astro pass); `oxfmt` now defaults to the cwd on its own and the
  astro pass is a `postformat` hook, so an argument reaches it. The hook still
  sweeps every `.astro`, which is a no-op unless one is genuinely unformatted —
  they all live under `website/src`.
- **`agent-docs` is on `.prettierignore`, and naming it explicitly overrides
  that.** oxfmt skips the tree when it walks into it, so those docs have never
  been formatted and are hand-wrapped. Passing the directory as an argument
  (`oxfmt agent-docs/`) formats all ~118 of them anyway — 9k lines of rewrapped
  prose and repadded tables around whatever you actually changed. Never format
  that path; the ignore is doing real work.
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the doc tables
  built from JSDoc tags — never hand-edit those.
- **Shaders are the one exception: `pnpm gen:shaders`, not `autogen`.**
  `*.generated.ts` is compiled from `.slang` by its own script, checked by its
  own CI job (Shaders), and `scripts/autogen.ts` has no shader generator — so
  `pnpm autogen` on a stale-shader failure rewrites nothing and looks like the
  check is wrong. Edit the `.slang`, never the generated module.
- **`pnpm gen:shaders` regenerates every shader in the repo, not just yours**,
  so in the shared checkout the next agent's regen commit sweeps up your
  `*.generated.ts` while your `.slang` sources are still uncommitted — which has
  happened, and reads afterwards as their commit having changed your shader.
  Commit sources promptly, or work in a worktree.
- **Check `gen:shaders`' EXIT CODE, not its output and not `git status`.** A
  `.slang` that fails to compile leaves its `.generated.ts` **untouched**, so
  the failure looks exactly like a file that needed no regen: the source shows
  modified, the generated module does not, and a second `gen:shaders` followed
  by a clean `git status` reads as "already in sync". Nothing downstream
  disagrees either — `tsc` and jest import the stale generated module and pass,
  because the only thing that changed is a `.slang` neither of them reads. The
  run says `gen:shaders failed: 1 of 51 .slang file(s) failed` and exits 1, and
  that line is the whole signal; piping to `grep -c 'ok:'` counts the survivors
  and hides it. A shader edit is verified by grepping the emitted WGSL for the
  thing you changed, which is one command and is conclusive.
- **A pass naming a packed colour uniform must `import colorPack;` itself.**
  Slang does not re-export through an import, so `import alignmentsUniforms` is
  not enough to call `unpackRGBA` even though that module uses it — the pattern
  every named-colour pass carries is the pair (`mismatch.slang`, `read.slang`).
  This is the most likely thing to be behind the silent stale-generated case
  above, since it is a compile error in the one file you just edited.
- **`jest.config.js`'s `.claude/` ignore is load-bearing — don't re-diagnose
  it.** Without it a nested agent worktree gives jest-haste-map duplicate
  `packages/__mocks__/**` and duplicate `plugins/*/package.json`, and the latter
  is a hard `_assertNoDuplicates` throw that fails every cross-package suite.
  Already fixed (`824e95eda3`).
- **Your test runs get 2 jest workers, deliberately — don't raise it.**
  `jest.config.js` reads `CLAUDECODE`, which the CLI exports into every command
  it runs, and hands agent sessions 2 where an interactive run gets 4. The point
  is the machine-wide total, which no per-run config can see: each concurrent
  agent worktree sizes itself independently, so several sessions at a
  "reasonable" per-run number still saturate the box together. Two sessions at
  the old `maxWorkers: '50%'` measured 8 workers **each** on a 16-core machine.
  If a run genuinely needs more, `JEST_MAX_WORKERS=<n>` outranks the tier for
  that one command — but a scoped `pnpm test <dir>` is nearly always the better
  answer, since wall-clock here is dominated by the serial transform prefix
  rather than by worker count.
- Two TypeScript versions on purpose: `typescript` 6.x for lint, aliased
  `typescript7` for `pnpm typecheck`. Don't unify them.
- The `@jbrowse/core/*` modules in `ReExports/modules.ts` are the ABI external
  plugins resolve against, guarded by `ReExports/abi.test.ts` against
  `abiBaseline.json`. Removals fail there; additions don't. To drop a name,
  delete it from the baseline in the same commit and say in the message which
  published plugins you checked.
- **The session is a second plugin-facing surface, and it fails quieter.** A
  plugin looks its members up at runtime, often behind `'x' in session`, so
  removing one throws nothing — the plugin just stops asking and silently does
  less. `jbrowse-web/src/tests/pluginFacingSessionApi.test.ts` pins the members
  published bundles actually call, same doctrine as the ABI baseline.
- `demos/<name>/config.json` deploys via `scripts/deploy-demo.sh`. Never
  `aws s3 cp` a config from elsewhere — the bucket has no versioning, so an
  overwrite that drops a track is unrecoverable.
