## Alignments / canvas

- Read cloud: show "read bars" on the reads themselves (currently just horizontal lines).
- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## Display height

Rename "display mode" to "set feature height" — see the display-height-system
redesign options in [OTHER_IDEAS.md](OTHER_IDEAS.md).

## Fused AbortSignal + stopToken

See [REQUEST_ABORT_PLAN.md](REQUEST_ABORT_PLAN.md) — proposal, not implemented.

## Config quick-edits mutate shared hydrated nodes

A compensating fix is shipped (evict the dirtied hydration node on delta drop);
the deeper fix — never mutate the shared base-config node in place — would remove
the whole bug class. See
[CONFIG_EDIT_INPLACE_MUTATION.md](CONFIG_EDIT_INPLACE_MUTATION.md) — proposal,
not implemented.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.

## Synteny follow-ups

- `multiway_synteny/ecoli_pangenome` screenshot review is marked "bad" ("why
  are the synteny curves grey here?") — the default-color comment it was
  reacting to was stale (default is red, not grey; fixed in
  `SyntenyViewInit.ts`). Regenerate the screenshot and re-review to flip the
  status.
- `multiway_synteny/grape_peach_cacao` screenshot review is marked "bad":
  wants consistent coloring for the same block across levels (the shared
  middle genome should color-match between the peach–grape and grape–cacao
  ribbons). Separate design task, still open.



## more accurate cgiab

look at wakhan, pycnv

## more typescript improvements to cascadingmenu

## add extra large text svg mode for pub ready figures



## add dynamic nextstrain or more nextstrain demos



## deploy example-site to branch

# dotplot

in plugins/dotplot-view we have the idea of allocating space for refname labels. but in the hg19
  vs hg38 screenshot that we have in generate-screenshots the margins for refname labels on the axes
  are quite large maybe even oversized. can you check

## audit context menu code for e.g. alignments

## follow ups


- jbrowse-react-circular-genome-view's examples-site has the same verbose pattern in 4 files (Volvox.tsx, Managed.tsx, ShowTrack.tsx, Human.tsx) — worth the same cleanup for consistency across products.
- website/docs/tutorials/embed_linear_genome_view.md (the main "embedding" tutorial, not examples-site) still shows the old verbose form — likely the highest-traffic doc a new user reads, so it's the most valuable one to update even though it's outside what you scoped today.
- Push the shorthand one step further: refNameAliases/cytobands still require the full { adapter: { type: 'RefNameAliasAdapter', uri: '...' } } wrapper — a refNameAliases: { uri: '...' } shorthand (defaulting adapter.type) would trim that the same way, and it's the same preProcessSnapshot idiom already in place there.
- The riskier "auto-detect adapter type from extension" idea we discussed and deferred (fasta: 'foo.fa.gz' → infer BgzipFastaAdapter) is still on the table if you want maximal terseness, but I'd only do it if you're fine with implicit magic.
3

## occasionally mouseover on gene glyph does not show cursor pointer with mouseover shading


## only show 6ma methylation in chromatin_accessibility_6ma3

## add fit to height to jbrowse-img

## error in test


PASS default products/jbrowse-web/src/rootModel/rootModel.test.ts
  ● Console

    console.error
      Error: assembly name required for JBrowse 1 connection
          at Object.connect (/home/runner/work/jbrowse-components/jbrowse-components/plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts:38:19)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)

      26 |     return undefined
      27 |   }
    > 28 |   originalError.call(console, ...args)
         |                 ^
      29 | }
      30 |
      31 | console.warn = (...args) => {

      at console.error (config/jest/console.js:28:17)
      at Object.connect (plugins/legacy-jbrowse/src/JBrowse1Connection/model.ts:61:19)

PASS default plugins/comparative-adapters/src/PAFAdapter/PAFAdapter.test.ts
  ● Console

    console.warn
      unknown not found in this adapter

      42 |     return undefined
      43 |   }
    > 44 |   originalWarn.call(console, ...args)
         |                ^
      45 | }
      46 |

      at console.warn (config/jest/console.js:44:16)
      at plugins/comparative-adapters/src/PAFAdapter/PAFAdapter.ts:88:17


PASS jbrowse-img products/jbrowse-img/src/util.test.ts
  ● Console

    console.error
      rsvg-convert stderr: boom

      26 |     return undefined
      27 |   }
    > 28 |   originalError.call(console, ...args)
         |                 ^
      29 | }
      30 |
      31 | console.warn = (...args) => {

      at console.error (config/jest/console.js:28:17)
      at convert (products/jbrowse-img/src/util.ts:41:15)
      at products/jbrowse-img/src/util.test.ts:58:14
      at Object.<anonymous> (node_modules/.pnpm/expect@30.4.1/node_modules/expect/build/index.js:1824:9)
      at Object.throwingMatcher [as toThrow] (node_modules/.pnpm/expect@30.4.1/node_modules/expect/build/index.js:2235:93)
      at Object.<anonymous> (products/jbrowse-img/src/util.test.ts:59:8)3

## copilot



Use complete, ordered escaping for markdown table cell content:

    Escape backslashes first.
    Then escape pipe characters.

Escaping backslashes first prevents pre-existing \ from interfering with subsequent \| escaping. In docs/util.ts, update tableCell at line 926 to chain a backslash-global replacement before the pipe replacement, while preserving existing whitespace-collapsing and trimming behavior.

No new imports or helper methods are required.
Suggested changeset 1
docs/util.ts
@@ -920,10 +920,14 @@
}

// Flatten free-form JSDoc prose into one safe table cell: collapse newlines
// (a pipe table row can't span lines) and escape literal `|` so it can't be
// mistaken for a column separator.
// (a pipe table row can't span lines) and escape markdown metacharacters used
// here: backslash (escape char) and literal `|` (table column separator).
export function tableCell(text: string | undefined) {
  return (text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
  return (text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim()

## ci type error



Run pnpm typecheck

> root@0.0.0 typecheck /home/runner/work/jbrowse-components/jbrowse-components
> tsgo --noEmit

Error: aws/blat-proxy/src/index.ts(10,8): error TS2307: Cannot find module 'aws-lambda' or its corresponding type declarations.
Error: aws/blat-proxy/test/proxy.test.ts(1,38): error TS2307: Cannot find module 'vitest' or its corresponding type declarations.
Error: aws/blat-proxy/vitest.config.ts(1,30): error TS2307: Cannot find module 'vitest/config' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 1.
Error: Process completed with exit code 1.

## err


Run pnpm --filter lgv-examples-site smoke

> lgv-examples-site@0.0.0 smoke /home/runner/work/jbrowse-components/jbrowse-components/products/jbrowse-react-linear-genome-view/examples-site
> node scripts/smoke.mjs

FAIL pan-ukb-gwas
     console: Error: HTTP 503 fetching https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt

40/41 pages OK
/home/runner/work/jbrowse-components/jbrowse-components/products/jbrowse-react-linear-genome-view/examples-site:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  lgv-examples-site@0.0.0 smoke: `node scripts/smoke.mjs`
Exit status 1

## odd scroll behavior on embedded

scrolls per-track, then scrolls page, and continues to be attached to per track scroll even after mouse has left
