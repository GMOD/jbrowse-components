import { parseSessionSpecUrl } from '../../packages/app-core/src/SessionSpec/parseSessionSpecUrl.ts'
import { parseProtocolUrl } from '../../products/jbrowse-desktop/electron/launchTarget.ts'
import { buildRecipe } from '../src/lib/spec-recipe/recipe.ts'
import { screenshotLiveUrls } from './screenshot-specs.ts'

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

// A RATCHET, not a target. The default is the count as it actually stands, so
// `--check` passes today and fails the moment a spec adds a field with no
// click-path — which is the only thing it can usefully detect. It used to
// default to 0 against a real count of 52, so it failed on every run and taught
// everyone to ignore it, which is worse than not having the check. Lower this
// as fields.ts grows (the unmapped list below is the worklist); never raise it
// without saying why.
const SPEC_RECIPE_BASELINE = 52
const BASELINE = Number(
  process.env.SPEC_RECIPE_BASELINE ?? String(SPEC_RECIPE_BASELINE),
)
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
      if (unwrapped !== recipe.desktopWebUrl) {
        throw new Error("jbrowse:// link doesn't unwrap to the link shown")
      }
      const { spec, configUrl, sessionName } = parseSessionSpecUrl(unwrapped)
      if (
        JSON.stringify(spec) !== JSON.stringify(JSON.parse(recipe.specJson))
      ) {
        throw new Error(
          'Desktop would load a different spec than the one shown',
        )
      }
      if (recipe.config && !configUrl) {
        throw new Error('config url lost in the round trip')
      }
      // Desktop persists the session name, so the screenshot generator's own
      // name must never reach a reader's session list
      if (!sessionName || /screenshot/i.test(sessionName)) {
        throw new Error(`session would be named "${sessionName}" in Desktop`)
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
