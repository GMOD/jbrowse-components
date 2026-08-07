# examples-site

Shared doctrine for all four examples sites — the copy-pasteable-file rule, the
"publish the block" escape hatch, the prose caps, `demoHeights.json`, the
puppeteer-probe pattern, the CI wiring — is
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
**Read it before adding a page or refactoring an example.** This file is only
what is local here.

The published package an example may import from is
`@jbrowse/react-linear-genome-view2`, plus the other published packages that doc
names. This site is where the no-shared-helpers rule was learned: it was built
with a `src/browser/` module first and had to be rewritten.

## `check-duplication.mjs` holds the copy-paste rule up from both sides

Run by `pnpm check-links`, and unique to this site. It asks two questions, and
they are not the same question.

**Are the copies identical?** Two top-level blocks with the same name in two
example files must match once comments are stripped. This exists because the
cost of the rule is drift — a pan-handler fix has to land in five files, and the
file that gets missed is a page teaching a bug with nothing to say so. A block
that genuinely differs per page goes in `DIVERGES` **with a reason**.

**Should the copies exist?** A block in `COPY_THRESHOLD` (3) files or more needs
a `COPIED` entry saying why it is the reader's own to write. Identical-ness says
nothing about this, so before `COPIED` existed a green run sat on ~1400
redundant lines and the "publish the block" escape hatch fired only when someone
happened to look. A failure here has two possible fixes and choosing between
them _is_ the check:

- the reader would write it anyway — their box, their track config, their app's
  dark-mode wiring — so add the entry.
- the reader would have to write it because JBrowse publishes no equivalent.
  That is a missing export. `usePanZoom` was eight hand-rolled copies, each
  worse than the gesture layer JBrowse already ran; `useSessionPalette` was
  eight copies of a `setConf` that silently discarded the host's configured
  theme colors.

Deliberately **not** a redundant-line budget. Adding a page adds copies, which
is the rule working; introducing a new widely-shared block is the event worth
interrupting. The line total is printed for the trend, and gates nothing.

Keep both lists short. If either starts growing, the shared surface has outgrown
copy-paste and the answer is a different rule argued here, not more entries.

## Two measured claims this site makes, and both are ratchets

- **`smoke.mjs` holds the evidence for this site's central claim**, in two
  halves: `MUI_BUDGET` counts `Mui*`-classed elements, and `muiThemedStyling`
  counts elements whose font came from MUI's default theme — which is the only
  way to see a `makeStyles` component, since an emotion class has no `Mui` in
  its name. Every page that installs `plainChromeOverlays` + `plainTrackControl`
  scores **zero** on both. When one fails, the fix is almost never to change the
  number — it is that a display started rendering a Material component that
  isn't behind either provider. Raising the budget quietly makes the prose
  false. Background: `agent-docs/reference/DISPLAYCHROME.md`, "The
  bring-your-own seams".
- **`eagerBundleSizes.json`** is written by `pnpm measure-eager-bundle` (what
  each page downloads before it can run — the static-import closure from its
  entry) and re-checked by `pnpm smoke`. Going **under** a budget fails as well
  as going over — bank the win by re-running and committing, or the next change
  quietly spends it. When a page goes over, the cause is essentially always one
  static import from an eagerly-evaluated module to a React component;
  `agent-docs/reference/EAGER_BUNDLE.md` names the three shapes and how to
  attribute a new one. Don't raise a budget to make it pass, for the same reason
  `MUI_BUDGET` isn't raised.

## `pnpm probe-eager-graph` answers *why*, and is the one to reach for first

`measure-eager-bundle` gives a number; this gives the modules behind it. It
rebuilds through `astro.config.probe.mjs` — the real config plus one Vite plugin
that dumps the pre-treeshake source graph (`buildEnd`) and the post-treeshake
chunks with per-module byte counts (`generateBundle`) — and intersects them, so
"is statically reachable" becomes "is actually paid for".

    pnpm probe-eager-graph                          costliest eager modules, by package
    pnpm probe-eager-graph --holds @mui/material/styles    who is keeping it here
    pnpm probe-eager-graph --no-build               reuse the last dump

It is committed because three sessions in a row rebuilt it from scratch, and
because every wrong bundle number in EAGER_BUNDLE.md's history came from
reasoning where this would have answered. Two of those traps are wired into it
rather than left as advice: it attributes at module level, never by chunk name
(a rolldown chunk is named after one of its modules and holds unrelated ones);
and when nothing first-party names the target directly it falls back to listing
the package's barrel importers, because `import { Button } from '@mui/material'`
records an edge to the barrel and a direct-importer query would report "nothing
to fix".

The dump lands in `node_modules/.cache/`, and the probe build overwrites `dist/`
like any other — re-run `pnpm build` before trusting a measurement taken after
it.

The chrome bundle figures in the prose come from the repo-root
`scripts/measureChromeBundle.ts` and its `pnpm autogen` entry.
