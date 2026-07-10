import { VOLVOX, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures that back the copy-paste recipes in docs/cookbook.md. Each spec
// applies the exact recipe config to the volvox genes track via inline per-track
// display options (the session-spec equivalent of the recipe's displayDefaults),
// so if a recipe's syntax ever goes stale the rendered figure changes and
// surfaces it — and every figure links to a live instance running that recipe.
export const cookbookSpecs: ScreenshotSpec[] = [
  // "Color by strand" recipe: volvox genes tinted blue on the + strand and red
  // on the - strand via the jexl color slot the recipe teaches.
  {
    mode: 'url',
    name: 'cookbook_color_by_strand',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1..50,000',
      tracks: [
        {
          trackId: 'gff3tabix_genes',
          height: 200,
          color: "jexl:feature.strand==1?'#1f77b4':'#d62728'",
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    viewportHeight: 320,
  },
]
