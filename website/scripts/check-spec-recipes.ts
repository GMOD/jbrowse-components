import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseSessionSpecUrl } from '../../packages/app-core/src/SessionSpec/parseSessionSpecUrl.ts'
import { parseProtocolUrl } from '../../products/jbrowse-desktop/electron/launchTarget.ts'
import { lookupTrack } from '../src/lib/spec-recipe/configs.ts'
import {
  decodeSpecUrl,
  specDisplayType,
  specTrackId,
  specTracks,
} from '../src/lib/spec-recipe/decode.ts'
import { GRAPH_LABELS } from '../src/lib/spec-recipe/fields.ts'
import { buildRecipe } from '../src/lib/spec-recipe/recipe.ts'
import { check } from './check-utils.ts'
import { norm, sourceLabels } from './menu-label-corpus.ts'
import { pluginCheckout } from './paths.ts'
import { screenshotLiveUrls } from './screenshot-specs.ts'

// Checks the figure recipes against every real figure link.
//
// 1. The "Open in JBrowse Desktop" link crosses three modules that are
//    otherwise only tested apart: the website builds it, Desktop's main process
//    unwraps it, and app-core parses what's inside. Running each figure through
//    the whole chain is what catches an over-strict rule at one end — the
//    deliberate `views: []` of the import-form figures was rejected until this
//    ran. A break here is a build error.
// 2. Session-spec fields with no click-path yet are the worklist for growing
//    src/lib/spec-recipe/fields.ts. The bare run writes their names to
//    spec-recipe-unmapped.txt; `--check` fails when the committed list differs,
//    naming what moved.
// 3. A height step names the menu row after what the track holds ("Read
//    height" on a pileup, "Feature height" otherwise), and the noun comes from
//    the display the spec names or the track's own type. With neither it used
//    to fall back to "feature" silently, which put the wrong row in 31
//    figures' recipes — every one of them a pileup, because a hosted config's
//    track type is unreadable at build time and most figures load one. So an
//    entry that sets a height field has to resolve one of the two.
// 4. The graph view's labels are copied out of a plugin this repo does not
//    build, so a rename there leaves every graph figure's recipe naming a
//    control that no longer exists, with no commit here to notice it. Checked
//    against a sibling checkout when one is on disk, and reported as skipped
//    when it is not.
//
// Lives here rather than in a *.test.ts because jest doesn't cover website/,
// and screenshot-specs.ts pulls puppeteer in through its barrel.

// The unmapped list is checked in rather than compared against a hand-kept
// count, because the count could not say which field moved: it reported "54
// exceeds 52" and left you diffing its own output by eye, it fired on whoever
// merged next rather than on whoever added the field, and it went green on a
// swap (map one field, add another) — a real regression at an unchanged total.
// The names make the regression the reviewable thing: a `+` line in the diff is
// a figure whose recipe a reader can no longer follow, a `-` line is the win.
const unmappedFile = join(import.meta.dirname, 'spec-recipe-unmapped.txt')

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

// Fields whose recipe titles the menu after the track's noun (fields.ts's
// `heightMenu`). Nothing else in the table reads `noun`.
const NOUN_FIELDS = new Set(['featureHeight', 'heightMode'])

const nounless: string[] = []
for (const [name, url] of Object.entries(screenshotLiveUrls)) {
  const decoded = decodeSpecUrl(url)
  if (!decoded) {
    continue
  }
  const { config, spec } = decoded
  const sessionTracks = spec.sessionTracks
  const walk = (views: typeof spec.views) => {
    for (const view of views ?? []) {
      for (const entry of specTracks(view)) {
        if (!Object.keys(entry).some(field => NOUN_FIELDS.has(field))) {
          continue
        }
        const trackId = specTrackId(entry)
        const info = lookupTrack(config, trackId, sessionTracks)
        if (!specDisplayType(entry) && !info?.type) {
          nounless.push(
            `  ${name}: "${trackId}" sets a height with no display type and no readable track config — add \`type\` to the spec entry so the recipe knows whether its rows are reads or features`,
          )
        }
      }
      walk(view.views)
    }
  }
  walk(spec.views)
}

const unmapped = [...unmappedCounts].sort((a, b) => b[1] - a[1])
console.log(
  `figures=${figures} withSessionSpec=${withRecipe} desktopLinkFailures=${roundTripFailures.length} unmappedFields=${unmapped.length}`,
)
for (const failure of roundTripFailures) {
  console.error(`  BROKEN  ${failure}`)
}
if (nounless.length > 0) {
  console.error('\nA height step with no noun to name its menu row:')
  for (const line of nounless) {
    console.error(line)
  }
  process.exit(1)
}
for (const [field, count] of unmapped) {
  console.log(`  ${String(count).padStart(3)}  ${field}`)
}

const graphSrc = join(pluginCheckout('graphgenomeview'), 'src')
if (existsSync(graphSrc)) {
  const rendered = new Set([...sourceLabels([graphSrc])].map(norm))
  if (rendered.size === 0) {
    console.error(`  ${graphSrc} exists but yields no label literals.`)
    process.exit(1)
  }
  const missing = Object.entries(GRAPH_LABELS).flatMap(([control, labels]) =>
    labels
      .filter(label => !rendered.has(norm(label)))
      .map(label => `  ${control}: no source renders ${JSON.stringify(label)}`),
  )
  if (missing.length) {
    console.error(
      `\nGraph view labels in spec-recipe/fields.ts no longer exist in the plugin:\n${missing.join('\n')}\n\nRe-read them off the checkout and update the tables.`,
    )
    process.exit(1)
  }
  console.log('graph view labels all resolve in the plugin checkout')
} else {
  console.log(
    `graph view labels unchecked (no checkout at ${graphSrc}) — a rename there would go unseen`,
  )
}

// A broken desktop link is always an error: it means a figure's "Open in
// Desktop" link would fail or open something other than the figure.
if (roundTripFailures.length) {
  process.exit(1)
}
const content = `# AUTO-GENERATED by scripts/check-spec-recipes.ts — do not edit by hand.
# Session-spec fields that no figure recipe can turn into a click-path yet, so
# the recipe dialog shows them in its JSON tab but can't tell a reader where the
# setting lives. Regenerate with \`pnpm check-spec-recipes\`.
#
# Adding a name here is a coverage regression — prefer a verified click-path in
# src/lib/spec-recipe/fields.ts. Removing one is the win.
${[...unmappedCounts.keys()].sort().join('\n')}
`

if (check) {
  const committed = readFileSync(unmappedFile, 'utf8')
  if (committed === content) {
    console.log('scripts/spec-recipe-unmapped.txt is up to date')
  } else {
    const before = new Set(
      committed
        .split('\n')
        .filter(line => line !== '' && !line.startsWith('#')),
    )
    for (const field of [...unmappedCounts.keys()].sort()) {
      if (!before.has(field)) {
        console.error(`  + ${field}  (no click-path in spec-recipe/fields.ts)`)
      }
    }
    for (const field of [...before].sort()) {
      if (!unmappedCounts.has(field)) {
        console.error(`  - ${field}  (now mapped)`)
      }
    }
    console.error(
      '\nscripts/spec-recipe-unmapped.txt is out of date — add a verified click-path to src/lib/spec-recipe/fields.ts, or run `pnpm check-spec-recipes` and commit the list',
    )
    process.exit(1)
  }
} else {
  writeFileSync(unmappedFile, content)
  console.log(`wrote ${unmappedFile}`)
}
