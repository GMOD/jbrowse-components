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

## `check-duplication.mjs` holds the copy-paste rule up from the other side

Run by `pnpm check-links`, and unique to this site: two top-level blocks with
the same name in two example files must be identical once comments are stripped.
It exists because the cost of the rule is drift — a pan-handler fix has to land
in five files, and the file that gets missed is a page teaching a bug with
nothing to say so. A block that genuinely differs per page goes in the script's
`DIVERGES` map **with a reason**. Keep that list short: if it starts growing,
the shared surface has outgrown copy-paste and the answer is a different rule
argued here, not more entries.

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

The chrome bundle figures in the prose come from the repo-root
`scripts/measureChromeBundle.ts` and its `pnpm autogen` entry.
