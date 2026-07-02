- make ability for read cloud to show 'read bars' on the reads themselves (currently just horizontal lines
- group by strand plugins/canvas



## Fused abortsignal+stoptoken?







## toggle off tooltips
for multivariantdisplay

## display mode -> rename to set feature height

## add option "hide this feature" to multisamplevariantdisplay, etc




## xref dotplot

On the dotplot, if you're zoomed all the way out and then place your mouse near the edge of the plot and scroll to zoom in, the plot "jumps" so the cursor isn't on the same region anymore. At all other zoom levels, the area under the cursor stays smoothly under it when zooming, it's just from the max zoomed out level, and is much more noticeable when the cursor is near the edge of the plot.


## menu consolidates

- multi-wiggle trackMenuItems() (~93 lines) — same pattern, direct hic/maf precedent. Caveat: needs a couple of internal interfaces exported across packages (WithResolution), so slightly more plumbing.
- Small genuinely-pure transforms — alignments colorLegendCategories / buildCoverageBlocks, variant colorByAttributes. These are the cleanest demonstrations of the lever (plain args in, plain data out, zero self) but small (~15 lines each).

## many variants, turns into collapsed, looks like solid block, but is not. any way to convey this? should we not collapse by default maybe?

## sv

Now let's regenerate these two new screenshots and remove the stale chr5 link plus replace the KRAS/SMAD4 prose links with real Figures.

 Ran 2 shell commands

Both rendered. Let's review both before wiring into the doc.

 Read 2 files, ran 2 shell commands
You've hit your session limit · resets 12:10am (America/Los_Angeles)

✻ Baked for 1h 24m 10s

✻ Claude resuming /loop wakeup (Jul 1 10:57pm)

Good — this confirms the SMAD4 CN=1 LOH block (chr18:28,482,566-80,363,285) matches the figure and caption. That earlier scheduled check already resolved (I completed the investigation and am now implementing it). Continuing — let's wire the doc.

 Read 1 file
You've hit your session limit · resets 12:10am (America/Los_Angeles)
/usage-credits to request more usage from your admin.

## avoid showing percentages if it gets stalled or just instantly...should be loading for at least like 500ms or something



## sort icons

import SwapVertIcon from '@mui/icons-material/SwapVert';

## dont do codeql so much ?

Write(test_data/volvox/annotate_variants.mjs)
Wrote 85 lines to test_data/volvox/annotate_variants.mjs
#!/usr/bin/env node
// Injects simulated SnpEff `ANN` consequence annotations into a multi-sample
// VCF so the "Color cells by consequence" mode of the multi-sample variant
// display has data to render. Each record gets one ANN entry per ALT allele
// with a deterministic impact tier (HIGH/MODERATE/LOW/MODIFIER) cycled by
// position, giving a visible spread of impact colors across the track.
//
// Usage:
//   node annotate_variants.mjs [input.vcf.gz] [output.vcf.gz]
// Defaults to rewriting volvox.test.vcf.gz in place. Requires bgzip + tabix on
… +76 lines

## live eval jexl

## next


 FAIL  products/jbrowse-web/src/tests/DotplotViewInit.test.tsx (13.295 s)
  ● DotplotView showImportForm is false when init is set

    expect(received).toBe(expected) // Object.is equality

    Expected: false
    Received: undefined

      76 |   })
      77 |
    > 78 |   expect(view.showImportForm).toBe(false)
         |                               ^
      79 |   expect(view.hasSomethingToShow).toBe(true)
      80 |
      81 |   await waitFor(

      at Object.<anonymous> (products/jbrowse-web/src/tests/DotplotViewInit.test.tsx:78:31)

  ● DotplotView showImportForm is true when no init

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: undefined

      94 |   const view = session.addView('DotplotView', {})
      95 |
    > 96 |   expect(view.showImportForm).toBe(true)
         |                               ^
      97 |   expect(view.hasSomethingToShow).toBe(false)
      98 | }, 40000)
      99 |

      at Object.<anonymous> (products/jbrowse-web/src/tests/DotplotViewInit.test.tsx:96:31)

 FAIL  products/jbrowse-web/src/tests/TextSearching.test.tsx (87.244 s)
  ● failed search resets input to visible location

    thrown: "Exceeded timeout of 70000 ms for a test.
    Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."

      129 | }, 70_000)
      130 |
    > 131 | test('failed search resets input to visible location', async () => {
          | ^
      132 |   const consoleMock = jest.spyOn(console, 'error').mockImplementation()
      133 |   const { input, findByText, view } = await doSetup()
      134 |

      at Object.<anonymous> (products/jbrowse-web/src/tests/TextSearching.test.tsx:131:1)

