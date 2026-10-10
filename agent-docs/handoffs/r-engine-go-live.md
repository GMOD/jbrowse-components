---
name: r-engine-go-live
description: "Steps left to take @jbrowse/tables and ggjbrowse live: the first npm publish by hand, creating GMOD/ggjbrowse, and merging the downstream repos' check scripts so the downstream canary goes green."
---

# @jbrowse/tables and ggjbrowse: going live

Written 2026-10-10. The design and hooks are in
[TABLES.md](../reference/TABLES.md). Colin authorized every step below.

1. **Publish `@jbrowse/tables` once by hand.** Drop `private` from
   `packages/tables/package.json`, `pnpm build` there, then
   `pnpm publish --tag next --no-git-checks` (npm is logged in as cmdcolin).
   Then add the trusted publisher on npmjs.com, or the next release tag's
   `pnpm publish -r` fails on it.
2. **Create GMOD/ggjbrowse** from `~/src/ggjbrowse` (local repo, committed):
   `gh repo create GMOD/ggjbrowse --public --source ~/src/ggjbrowse --push`.
   Rebuild its bundle from main first (its build-js script) so the header
   names a landed commit.
3. **Merge the check-against-jbrowse script commits** waiting in
   `~/src/JBrowseR` and `~/src/jbrowse-anywidget` (local branches, one commit
   each), fast-forward and push. The anywidget workflow edit has not been
   through prettier.
4. Until 2 and 3 land, the downstream canary is red for those repos.

The R exporter work is separate and still
unlanded; its handoff travels with it.
