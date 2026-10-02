---
name: toolchain
description: How do the TypeScript 6/7 split, the oxlint/eslint split, project references, worktree installs and dependency pruning work, and what breaks silently? Read before changing a TypeScript version, a tsconfig references array, a lint rule or a disable comment.
audience: internal
kind: operations
---

# Toolchain

The dev loop runs two TypeScript versions and two linters on purpose. Don't "fix"
either by unifying them.

## Why two TypeScript versions

- **The eslint backstop needs 6.x.** `pnpm lint` is oxlint, type-aware through
  tsgolint, which uses its own TS7-based checker and ignores the ambient
  `typescript`. `pnpm lint:eslint` parses with `@typescript-eslint`, whose
  `ts-api-utils` peer range is `<6.1.0`, so bumping the ambient `typescript` breaks it.
- **Typecheck and `build:esm` want 7.x for speed.** Both call the aliased
  `typescript7` devDependency by path (`scripts/typecheck.ts`). Use `pnpm
  typecheck`, never a bare `tsc`. `products/jbrowse-cli` still builds with ambient 6.x.

The two versions write **incompatible** `.tsbuildinfo` and each discards the
other's, so don't share a `.tsbuildinfo` CI cache between them.

## Project references

**Module augmentations must be reachable from the package entry.** A `declare
module` block (`ExtensionPointRegistry`, `RpcRegistry`) applies only in programs that
load the declaring file, and across packages a consumer sees only the `.d.ts` files
reachable from the dependency's entry. Put cross-package augmentations in a file the
entry re-exports a named binding from. `import type {} from './X.ts'` does **not**
work: TS elides binding-less imports from declaration emit. Symptoms: `TS2488 Type
'unknown' must have a '[Symbol.iterator]()' method` at an `addToExtensionPoint`
callback, or `contributeToExtensionPoint` rejecting the name outright.

## Linting: who owns what

- **`.oxlintrc.json` cannot carry comments.** `eslint.config.mjs` imports it with
  `with { type: 'json' }`, a strict `JSON.parse`, so a `//` comment breaks `pnpm
  lint:eslint` with an error that does not name the comment. A `"//key"` entry fails
  too, since oxlint reads every key under `rules` as a rule name. Rationale for an
  oxlint rule goes in its commit message.
- **Neither linter reports unused disable directives.** Both read the same
  `eslint-disable` comments and each runs only part of the rule set, so suppressions
  that suppress nothing accumulate.
- **`eslint-disable-next-line` means the next line.** A directive followed by more
  comment lines applies to the comment and fails silently. Put the prose first and the
  directive last.
## Worktrees

- **Check what the worktree branched from before trusting a gate.** `setup-worktree.sh`
  branches from local `main` on purpose, since `origin/main` lags it by dozens of
  commits. A worktree made another way can still predate a fix, so a gate
  fails on it. `git merge-base --is-ancestor main HEAD` tells
  you; `git rebase main` fixes it. A `git diff main` naming files you never opened is
  the tell.
- **A hand-made worktree is not an installed one.** `git worktree add` installs
  nothing, and typecheck dies without the gitignored `buildInfo.ts`. Don't symlink
  `node_modules` from the primary checkout: the per-package `@jbrowse/*` links are
  relative and resolve back to its sources.
- **`TS2307` on a `@jbrowse/*` subpath is a missing link, never a missing build.** A
  rebase that picks up a new workspace package leaves the install behind. `pnpm
  install` fixes it in seconds. A plain dependency bump does the same without
  `TS2307`: the rebased worktree typechecks against the old package and reports errors
  the bump fixed. Run `pnpm install --frozen-lockfile`. It cannot be a stale `esm/`:
  workspace exports point at `src`. The exception is jbrowse-img's CLI from source,
  which needs `pnpm build` (`products/jbrowse-img/src/resolve.ts`).

`pnpm format` is safe bare. But `agent-docs` is on `.prettierignore` and **naming it
explicitly overrides that**, rewrapping thousands of lines of prose.

**`pnpm autogen` needs a clean tree.** `pnpm gendocs` resolves sources through the
`@jbrowse/*` workspace links, so a dirty shared tree leaks into the output and then
fails the CI check. A temp worktree with symlinked `node_modules` does not escape it.
Run it clean and commit the output by itself.

## A `dependencies` entry can be load-bearing without being imported

When one goes:

- Re-run `scripts/generate-tsconfig-references.ts`: a workspace dependency has a
  derived project reference.
- Grep the importers and confirm each declares it; removing a dep another package
  imports without declaring turns a working install into a hoisting accident.
- Use `pnpm install --lockfile-only` in a shared worktree.
- **Confirm the prune before believing a green typecheck.** Typecheck fails on a
  removed dep only once its per-package `node_modules` symlink is gone. `ls -d` the
  removed link and a kept dep as a control; an empty first result means nothing unless
  the control is still linked.
