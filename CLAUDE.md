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
- **A fresh worktree has no `node_modules` and no figures**, so every
  `website/scripts/*.ts` dies on
  `Cannot find package '@jbrowse/browser-test-utils'` and anything reading
  figures calls the whole corpus unpulled. Three symlinks beat a `pnpm install`
  — seconds, and no lockfile risk, because pnpm's internal links are absolute
  and resolve back into the primary checkout's store:

  ```
  ln -s ~/src/jbrowse-components/node_modules node_modules
  ln -s ~/src/jbrowse-components/website/node_modules website/node_modules
  ln -s ~/src/jbrowse-components/website/static/img website/static/img
  ```

  Linking `static/img` is also what lets figure tooling see the machine's real
  figures, unpushed regens included, which is the whole point of a before/after
  comparison. Delete the three before committing — they are gitignored, but they
  muddy a `git status` read. Note `puppeteer` is not hoisted to the root, so
  resolve it from `packages/browser-test-utils/` or run from a package that
  depends on it.

## MST

- `@jbrowse/mobx-state-tree` is our internal ESM fork; treat it like upstream.
- Keep the main model chain in one file; don't split `.views()`/`.actions()`
  across files.
- A bare getter returns a resolved value, never `undefined`. Where a prop
  encodes a sentinel (`rowHeight === 0` = fit-to-height), expose the resolved
  value under a distinct getter every consumer reads.
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
- **`pnpm autogen` rewrites every generated-and-committed artifact** and is the
  answer to almost any "X is out of date" CI failure. It owns `package.json`
  `exports` maps, `tsconfig.build.esm.json` `references`, and the doc tables
  built from JSDoc tags — never hand-edit those.
- **Shaders are the one exception: `pnpm gen:shaders`, not `autogen`.**
  `*.generated.ts` is compiled from `.slang` by its own script, checked by its
  own CI job (Shaders), and `scripts/autogen.ts` has no shader generator — so
  `pnpm autogen` on a stale-shader failure rewrites nothing and looks like the
  check is wrong. Edit the `.slang`, never the generated module.
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
