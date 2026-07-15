import { DEMO_CONFIG, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures that back the copy-paste recipes in docs/cookbook.md. Each spec
// applies the exact recipe config to the volvox genes track via inline per-track
// display options (the session-spec equivalent of the recipe's displayDefaults),
// so if a recipe's syntax ever goes stale the rendered figure changes and
// surfaces it — and every figure links to a live instance running that recipe.
export const cookbookSpecs: ScreenshotSpec[] = [
  // "Color by strand" recipe: NCBI RefSeq genes on hg38 (reviewer: use hg38 +
  // ncbi gff) tinted blue on the + strand and red on the - strand via the jexl
  // color slot the recipe teaches. The chr17p13 window spans several genes on
  // both strands (TP53−, WRAP53+, ATP1B2, EFNB3, …) so both colors show.
  {
    mode: 'url',
    name: 'cookbook_color_by_strand',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr17:7,400,000-7,700,000',
      tracks: [
        {
          trackId: 'ncbi_refseq_109_hg38',
          height: 260,
          color: "jexl:feature.strand==1?'#1f77b4':'#d62728'",
        },
      ],
    }),
    readyText: 'NCBI RefSeq',
    readyTimeout: 60000,
    settleMs: 6000,
    viewportHeight: 460,
  },
]
