---
name: sweep-the-unused-exports-with-a-real-tool-or-close-the-question
description: configure knip per package; a grep returns hundreds of names and almost none are dead
metadata:
  area: tooling, CI
  category: measure-first
---

# Sweep the unused exports with a real tool, or close the question

Nothing in the repo looks for an exported name that no importer wants. The dead
*files* and dead *dependencies* were swept on 2026-08-16 (`f783f4444c`), and
that sweep is done — this entry is only the exports half it deliberately left.

**The premise is unconfirmed, and a grep will not confirm it.** A crude pass —
every `export const|function|class|interface|type|enum` whose identifier appears
in no other file — returns **hundreds of names** (623 when this was written, ~741
from a crude equivalent today, so read the size as indicative and not as a
figure), and spot-checking says almost none of them are dead:

- Most are exported *types* of published packages. `@jbrowse/core` and every
  `@jbrowse/plugin-*` ship to npm, so a type nobody imports in-tree is API, and
  removing it is an ABI break — see
  [reference/PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md).
- The examples-sites' components are consumed by Astro. A scanner that reads
  only `.ts`/`.tsx` never sees a `.astro` importer, and under `jsx: react-jsx`
  it never sees `react/jsx-runtime` either — the same blind spot that made
  `astro` and `react` read as dead dependencies in `f783f4444c`'s first pass.
- `_AssertAddSessionTrack` / `_AssertPublishTrackConf`
  (`createSessionModel.ts:102,106`, which `f1a0a46316` split out of the single
  `_AssertAddTracks` this used to name), `AssertEnumListsCoverUpstream` and
  friends are compile-time assertions. Appearing once is what they are for.

So the first move is **not** to delete anything. Run `knip` (or `ts-prune`)
configured per package — entry points declared, published `exports` maps treated
as roots, `products/` separated from `packages/` and `plugins/` because only the
first is an app rather than a library — and see what survives that. If the
surviving set is small and boring, take it; if it is still noise, close this
entry and say so, because the answer is then "there is no exports problem here"
rather than "nobody has looked".

Whatever the verdict, the tool belongs in `pnpm check-docs`'s neighbourhood only
if it is quiet on a clean tree. A gate that reports 600 findings teaches everyone
to skip it.
