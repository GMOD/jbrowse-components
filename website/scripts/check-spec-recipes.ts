import { screenshotLiveUrls } from './screenshot-specs.ts'
import { parseSessionSpecUrl } from '../../packages/app-core/src/SessionSpec/parseSessionSpecUrl.ts'
import { parseProtocolUrl } from '../../products/jbrowse-desktop/electron/launchTarget.ts'
import { buildRecipe } from '../src/lib/spec-recipe/recipe.ts'

// Checks the figure recipes against every real figure link.
//
// 1. The "Open in JBrowse Desktop" link crosses three modules that are
//    otherwise only tested apart: the website builds it, Desktop's main process
//    unwraps it, and app-core parses what's inside. Running each figure through
//    the whole chain is what catches an over-strict rule at one end — the
//    deliberate `views: []` of the import-form figures was rejected until this
//    ran. A break here is a build error.
// 2. Session-spec fields with no click-path yet are reported as the worklist
//    for growing src/lib/spec-recipe/fields.ts. `--check` fails past
//    SPEC_RECIPE_BASELINE.
//
// Lives here rather than in a *.test.ts because jest doesn't cover website/,
// and screenshot-specs.ts pulls puppeteer in through its barrel.

const BASELINE = Number(process.env.SPEC_RECIPE_BASELINE ?? '0')
const check = process.argv.includes('--check')

const unmappedCounts = new Map<string, number>()
const roundTripFailures: string[] = []
let figures = 0
let withRecipe = 0

for (const [name, url] of Object.entries(screenshotLiveUrls)) {
  figures++
  const recipe = buildRecipe(url)
  if (recipe) {
    withRecipe++
    for (const field of recipe.unmapped) {
      unmappedCounts.set(field, (unmappedCounts.get(field) ?? 0) + 1)
    }
    try {
      const unwrapped = parseProtocolUrl(recipe.desktopUrl)
      if (unwrapped !== recipe.liveUrl) {
        throw new Error("jbrowse:// link doesn't unwrap to the figure's url")
      }
      const { spec, configUrl } = parseSessionSpecUrl(unwrapped)
      if (JSON.stringify(spec) !== JSON.stringify(JSON.parse(recipe.specJson))) {
        throw new Error('Desktop would load a different spec than the one shown')
      }
      if (recipe.config && !configUrl) {
        throw new Error('config url lost in the round trip')
      }
    } catch (e) {
      roundTripFailures.push(`${name}: ${e instanceof Error ? e.message : e}`)
    }
  }
}

const unmapped = [...unmappedCounts].sort((a, b) => b[1] - a[1])
console.log(
  `figures=${figures} withSessionSpec=${withRecipe} desktopLinkFailures=${roundTripFailures.length} unmappedFields=${unmapped.length}`,
)
for (const failure of roundTripFailures) {
  console.error(`  BROKEN  ${failure}`)
}
for (const [field, count] of unmapped) {
  console.log(`  ${String(count).padStart(3)}  ${field}`)
}

// A broken desktop link is always an error: it means a figure's "Open in
// Desktop" link would fail or open something other than the figure.
if (roundTripFailures.length) {
  process.exit(1)
}
if (check && unmapped.length > BASELINE) {
  console.error(
    `\n${unmapped.length} unmapped spec fields exceeds baseline ${BASELINE}. Add a verified click-path to src/lib/spec-recipe/fields.ts, or raise SPEC_RECIPE_BASELINE.`,
  )
  process.exit(1)
}
