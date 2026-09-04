// Keeps a doc's fenced code blocks identical to real, compiled source.
//
// A hand-copied fence drifts silently: the example plugin can typecheck while
// the guide beside it teaches an undefined type or a renamed API, and no check
// in the repo can see the difference (check-doc-imports validates import
// *specifiers*, not the code around them).
//
// Opt in per fence by putting an include marker on the line above it:
//
//   <!-- include: example-plugins/score-example/src/ScoreRPC/GetScoreData.ts -->
//   ```ts
//   …generated: replaced with that file's contents…
//   ```
//
// For part of a file, mark a region in the source and reference it with `#`:
//
//   // #region execute            <!-- include: path/to/file.ts#execute -->
//   …
//   // #endregion
//
// Region bodies are dedented; the marker lines themselves are never emitted.
// Fences with no marker are left completely alone, so migration is incremental.
//
// Because unmarked fences are ignored, nothing would otherwise stop a *new*
// hand-written one appearing. `--check` therefore also ratchets: it counts the
// un-included TS/JS fences in the hand-written docs and fails if that total rises
// above DOC_FENCE_BASELINE, so the debt can only shrink.
//
// Run `pnpm sync-doc-snippets` to update, `--check` to fail on drift (CI).
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { check, docFiles } from './check-utils.ts'
import {
  countUnIncludedFences,
  extractRegion,
  isGeneratedDocPath,
  stripRegionMarkers,
} from './docFenceRegions.ts'
import { docsDir, repoRoot } from './paths.ts'

const MARKER = /^<!--\s*include:\s*(\S+?)\s*-->$/

function resolve(spec: string) {
  const [file, region] = spec.split('#')
  const source = readFileSync(join(repoRoot, file!), 'utf8')
  if (region) {
    return extractRegion(source, file!, region)
  }
  // A whole-file include still drops the region markers: they exist so *other*
  // docs can pull a slice, and they'd read as noise here.
  return stripRegionMarkers(source)
}

const problems: string[] = []
const stale: string[] = []

// Ratchet: the docs still carry hand-written TS/JS fences that predate this
// script, and nothing stops a new one being added. Counting the un-included
// ones and failing when the total *rises* freezes that debt without demanding a
// big-bang conversion — the number only ever goes down, one page at a time.
// A count works here, unlike the spec-recipe ratchet that became a tracked list
// of field names: an un-included fence has no stable identity to list, so there
// is nothing to name in the diff beyond the file it sits in.
//
// Scope is every hand-written page. `config/`, `models/` and `api/` are whole
// generated trees and `cli.md`/`jbrowse-img.md` are generated pages, so their
// fences come from a JSDoc tag at a definition site and are already tied to
// source. It covered `developer_guides/` alone until those were down to two,
// which left the ~20 fences in `config_guides/`, `tutorials/` and the top-level
// pages free to grow.
//
// Raised 19 -> 20 on 2026-08-07, which is the direction this is not supposed to
// move, so the reason is on the record. `agents_capture.md` arrived with two,
// taking the total to 21 and leaving `pnpm autogen --check` failing on main.
// One of them was the session gate, hand-copied from `sessionGate.ts` and
// already drifted from it — its copy had dropped the `?? []` and `?.` guards,
// so the snippet a reader was invited to paste threw on a view whose tracks had
// not arrived. That one is an include now, and the drift it was in the middle
// of is the argument for this ratchet existing.
//
// The other is a usage example of `@jbrowse/capture`'s public API under
// "Writing your own script": openJBrowse, then a click, then a read back out of
// the running app. Nothing in the repo compiles that shape — `captureJBrowse`
// is the one-call form and does not click anything — so there is no source to
// point at, only source that could be written to be pointed at. Writing an
// example module into a published package to satisfy a docs checker is a bigger
// decision than this ratchet should make on its own, so the debt is recorded
// instead. Convert it by adding that example and lower this by one more.
//
// 20 -> 18 on 2026-08-12: `automating.md` hand-wrote `InitState` and
// `TrackInit` as paraphrases, and the InitState one had already lost the
// difference between the two kinds of key it documents — `drawer_widgets.md`
// includes the real declaration and says the split matters. Both are includes
// now, `TrackInit` having gained a region marker at its declaration.
//
// 18 -> 19 on 2026-08-15: `jbrowse-capture.md` (mirrored from
// products/jbrowse-capture/README.md) carries the README's own "## Library"
// example — captureJBrowse/openJBrowse usage — for the same reason the
// "Writing your own script" example above is exempt: nothing in the repo
// compiles that exact shape, so there is no source to point an include at.
//
// 19 -> 20 on 2026-08-17: `agents_capture.md` leads with the one-line readiness
// wait, `await page.waitForSelector('[data-app-phase="ready"]')`. The selector
// itself IS source — `APP_READY` in products/jbrowse-capture/src/waits.ts — but
// the fence teaches the puppeteer call around it, and nothing in the repo
// compiles that call: `@jbrowse/capture` wraps it in `waitForAppReady`, which
// is the thing the page is telling a reader they can do without. An include
// pointing at the const would put a declaration where the page needs a call.
//
// 20 -> 21 on 2026-08-18: `embedded_components.md` gained a second imperative
// controller example when `createCircularGenomeView` landed (fe371f0346), the
// twin of the `createLinearGenomeView` fence above it — which is already one of
// these 20, for the same reason. `createCircularGenomeView.test.ts` does compile
// those calls, but wraps them in jest and a `view.setWidth(800)` that only jsdom
// needs, so an include would teach a reader the harness instead of the API.
// 21 -> 24 on 2026-09-01: the three agent pages landed, and `agents_mcp.md`
// spent almost all of it. Its fences are a tour of the `jb` standard library —
// a list of one-line calls with a trailing comment each, then a worked
// loadSessionSpec and a getFeatures read — assembled for a reader rather than
// lifted from anywhere. `jbApi.test.ts` exercises the same functions, but as
// assertions around them, so an include would put the harness on the page where
// the point is the call. `agents.md` adds one, and `agents_web.md` adds ZERO
// deliberately: its examples are prose and inline code for exactly this reason,
// which is the pattern to copy rather than this raise.
//
// 24 -> 49 on 2026-09-01: `agents_recipes.md` (16) and `agents_live_model.md`
// (9) landed. Every recipe fence is a `run_javascript` body — the thing a reader
// pastes into MCP — and the live-model page's are the reads and writes an agent
// makes against a session it already holds. Neither has a source file to point
// at: the bodies are the API surface, not code we ship, and the tests that cover
// the same calls assert around them rather than running them as written.
//
// Note main had already come DOWN to 19 against this 21 when the raise landed,
// so the honest figure for what these pages cost is +5, not +3. Lower it again
// the moment a tested `jb` example fixture exists to point at — that is the
// conversion this debt is waiting on, and it would buy back most of the six.
//
// 49 -> 41 on 2026-09-02: the agent pages were consolidated. `agents_mcp.md`
// and `agents_web.md` folded into `agents.md` and `agents_live_model.md`, the
// recipes page dropped two entries, and `agents_capture.md` kept only the
// selectors the generated `@jbrowse/capture` reference does not carry.
//
// 41 -> 40 on 2026-09-02: `automating.md` absorbed `config_and_session_json.md`
// and dropped its hand-rolled puppeteer script; `agents_capture.md` and the
// generated `@jbrowse/capture` reference carry the waits.
//
// 40 -> 35 on 2026-09-02: the quickstarts and config_guides passes cut every
// guide to what the generated config/model pages and the cookbook don't
// already carry, dropping fences those pages restated.
//
// 35 -> 37 on 2026-09-04: `upgrading_v5.md` gained the lazy-stateModel breakage
// (0ea3f65617), which is a before/after pair. The "before" is the v4 idiom, code
// this tree no longer contains and so has nothing to point at; the "after" is
// the shape a plugin author writes, not a region we ship. A migration guide's
// pair is the case this baseline's own instruction calls "genuinely can't be" —
// but it is still debt, and it is the only kind that should raise this number.
const FENCE_BASELINE = Number(process.env.DOC_FENCE_BASELINE ?? '37')
let unIncluded = 0

for (const path of docFiles(docsDir)) {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  const out: string[] = []
  let changed = false

  if (!isGeneratedDocPath(relative(docsDir, path))) {
    unIncluded += countUnIncludedFences(text)
  }

  for (let i = 0; i < lines.length; i++) {
    const marker = MARKER.exec(lines[i]!.trim())
    out.push(lines[i]!)
    if (!marker) {
      continue
    }
    // prettier puts a blank line between the marker and the fence, so skip
    // blanks rather than silently ignoring the marker (which would leave a
    // stale fence passing --check — the exact drift this script prevents).
    // Other HTML comments are skipped for the same reason, and one of them is
    // load-bearing: a region's body is dedented, so a source line that only
    // wrapped because of its indentation fits on one line in the fence, and
    // oxfmt formats fenced code. That reflow then fails `--check` here, and
    // undoing it fails check-format — the two cannot both pass without
    // `<!-- prettier-ignore -->` sitting between the marker and the fence.
    let openAt = i + 1
    while (
      lines[openAt]?.trim() === '' ||
      lines[openAt]?.trim().startsWith('<!--')
    ) {
      openAt++
    }
    if (!lines[openAt]?.startsWith('```')) {
      problems.push(
        `${path}: include marker for ${marker[1]} has no code fence`,
      )
      continue
    }
    const fenceOpen = lines[openAt]!
    // Match the opener's backtick run rather than assuming three. Most config
    // schemas carry a JSDoc `#example` containing its own ``` fence, so a doc
    // that includes one gets escalated to ```` by prettier — and emitting a
    // hardcoded ``` closer against that opener leaves the fence unterminated,
    // swallowing the rest of the page into one code block.
    const delim = /^`+/.exec(fenceOpen)![0]
    const closeAt = lines.indexOf(delim, openAt + 1)
    if (closeAt === -1) {
      problems.push(`${path}: unterminated fence after ${marker[1]}`)
      continue
    }
    let body: string
    try {
      body = resolve(marker[1]!)
    } catch (e) {
      problems.push(`${path}: ${String(e)}`)
      continue
    }
    const current = lines.slice(openAt + 1, closeAt).join('\n')
    if (current !== body) {
      changed = true
    }
    out.push(
      ...lines.slice(i + 1, openAt),
      fenceOpen,
      ...body.split('\n'),
      delim,
    )
    i = closeAt
  }

  if (changed) {
    stale.push(path.replace(`${repoRoot}/`, ''))
    if (!check) {
      writeFileSync(path, out.join('\n'))
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
if (stale.length > 0) {
  if (check) {
    console.error(
      `Doc snippets are out of date with their source:\n${stale
        .map(s => `  ${s}`)
        .join('\n')}\nRun 'pnpm sync-doc-snippets' and commit the result.`,
    )
    process.exit(1)
  }
  for (const s of stale) {
    console.log(`  updated: ${s}`)
  }
} else {
  console.log('All doc snippet includes match their source.')
}

if (unIncluded > FENCE_BASELINE) {
  console.error(
    `\n${unIncluded} hand-written TS/JS fences in the docs exceeds the ` +
      `baseline of ${FENCE_BASELINE}. Point the new fence at real source with ` +
      `an <!-- include: --> marker (see example-plugins/score-example), or ` +
      `raise DOC_FENCE_BASELINE if it genuinely can't be.`,
  )
  process.exit(1)
} else if (unIncluded < FENCE_BASELINE) {
  console.log(
    `${unIncluded} hand-written TS/JS fences remain in the docs ` +
      `(baseline ${FENCE_BASELINE}) — lower DOC_FENCE_BASELINE to ${unIncluded} to hold the gain.`,
  )
}
