// What a run is going to render, and nothing about how.
//
// This is the whole of the generator's decision stage: validate the spec list,
// intersect --filter / --cover / --affected, pull in the compose figures whose
// parts the run touches, and refuse if the diff gate has nothing to compare
// against. It ran inline at the top of `main`, where it was the first ~140 of
// that function's lines and the only ones with no browser in them.
//
// It is also the part worth reading on its own: every flag composes by
// INTERSECTION, and each of them narrows for a different reason, which is easier
// to see when they are the only thing in the file.
import fs from 'node:fs'
import path from 'node:path'

import { fileExists, readManifest } from './figure-paths.ts'
import { matchesFilterTokens } from './filter-tokens.ts'
import {
  changedFilesFromGit,
  selectAffected,
  selectCover,
} from './screenshot-impact.ts'
import {
  affected,
  changedFrom,
  cover,
  exact,
  filterTokens,
  jbrowseImgOutDir,
  outDir,
  repoRoot,
  since,
} from './screenshot-options.ts'
import { validateSpecs } from './screenshot-spec-rules.ts'
import { specs } from './screenshot-specs.ts'

import type { ScreenshotSpec } from './screenshot-spec-types.ts'

// The repo-relative figure path(s) a spec writes, in the spelling figures.lock
// uses. A cli spec writes two: jb2export's own output under
// products/jbrowse-img/img and the website mirror captureCliSpec copies it to.
export function manifestPathsFor(spec: ScreenshotSpec): string[] {
  const rel = (abs: string) =>
    path.relative(repoRoot, abs).split(path.sep).join('/')
  const website = rel(path.join(outDir, `${spec.name}.png`))
  return spec.mode === 'cli'
    ? [
        website,
        rel(
          path.join(
            jbrowseImgOutDir,
            `${spec.name.replace(/^jbrowse-img\//, '')}.png`,
          ),
        ),
      ]
    : [website]
}

// `undefined` is "nothing to do", which is an ANSWER rather than a failure: a
// --affected run on a docs-only change has to be able to exit 0, so the caller
// returns rather than throwing. Every other refusal here exits non-zero itself,
// because each is a mistake the run cannot recover from.
export async function selectSpecsToRender(): Promise<
  ScreenshotSpec[] | undefined
> {
  // Before anything is rendered: a duplicate name or a compose part that names
  // no spec is an hour of capture producing a wrong figure, and neither fails on
  // its own (see validateSpecs). Same check CI runs via check-specs.ts.
  const specProblems = validateSpecs(specs)
  if (specProblems.length > 0) {
    console.error(
      `${specProblems.length} screenshot spec problem(s):\n${specProblems
        .map(p => `  - ${p}`)
        .join('\n')}`,
    )
    process.exit(1)
  }

  // `--filter a,b,c` matches a spec when any comma-separated token matches, so
  // "re-render these few" is one invocation instead of a shell loop. The flag is
  // repeatable and the tokens union. Parsed once at module scope, since it also
  // decides forceCommit.
  let selected = specs.filter(s =>
    matchesFilterTokens(s.name, filterTokens, exact),
  )

  if (selected.length === 0) {
    console.error(`No specs match filter: ${filterTokens.join(',')}`)
    process.exit(1)
  }

  // `--cover` narrows to the smallest set that still puts every declared type on
  // screen. It answers a different question from --affected: not "which figures
  // could have moved" but "does every type still launch, paint and settle" — the
  // half of the corpus's value that does not need 329 renders. Composes with the
  // others by intersection, like --filter.
  if (cover) {
    const { names, uncovered } = selectCover()
    const before = selected.length
    selected = selected.filter(s => names.has(s.name))
    const gap =
      uncovered.length > 0
        ? `\n  (${uncovered.length} type(s) only an unresolved spec declares, so no spec here reaches them: ${uncovered.join(', ')})`
        : ''
    console.log(
      `--cover: ${before} -> ${selected.length} spec(s) covering every declared type${gap}`,
    )
  }

  // `--affected` narrows the sweep to specs a change could plausibly have moved
  // (see screenshot-impact.ts for how, and for what it deliberately can't
  // prove). Deliberately does NOT imply --force the way --filter does: --filter
  // is "re-render these, I mean them", while this is "skip the ones nothing
  // could have touched", so the content-stable diff gate still decides what gets
  // rewritten. It also composes with --filter rather than replacing it — both
  // narrow, so the run is the intersection.
  if (affected) {
    const ref = since ?? 'HEAD'

    const changed = changedFrom
      ? fs
          .readFileSync(changedFrom, 'utf8')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      : changedFilesFromGit(ref)
    const selection = await selectAffected(changed)
    console.log(
      `--affected: ${changed.length} file(s) ${changedFrom ? `from ${changedFrom}` : `changed since ${ref}`}${
        selection.reasons.length
          ? `\n${selection.reasons
              .slice(0, 8)
              .map(r => `  · ${r}`)
              .join('\n')}`
          : ''
      }`,
    )
    if (selection.kind === 'none') {
      console.log('  nothing changed that renders a figure — nothing to do')
      return undefined
    }
    if (selection.kind === 'some') {
      const before = selected.length
      selected = selected.filter(s => selection.names.has(s.name))
      console.log(
        `  narrowed ${before} -> ${selected.length} spec(s) of ${specs.length}`,
      )
      if (selected.length === 0) {
        console.log('  (nothing left after --filter) — nothing to do')
        return undefined
      }
    } else {
      console.log(`  no narrowing possible — running all ${selected.length}`)
    }
  }

  // The figure a doc publishes for a compose spec is the STACK, not the parts.
  // Re-rendering a part on its own (`--filter pangenome/graph_resolution_pggb`)
  // would leave that stack showing the old part, with nothing to say so — so pull
  // in every compose spec whose parts this run touches.
  const selectedNames = new Set(selected.map(s => s.name))
  const impliedCompose = specs.filter(
    s =>
      s.mode === 'compose' &&
      !selectedNames.has(s.name) &&
      s.parts.some(p => selectedNames.has(p)),
  )
  const filteredSpecs = [...selected, ...impliedCompose]

  // THE DIFF GATE NEEDS THE FIGURES IT COMPARES AGAINST, and this is where the
  // run finds out. commitScreenshot treats a missing output as a brand-new
  // figure and writes it unconditionally — correct for a new spec, catastrophic
  // for all of them at once. Figure bytes are gitignored, so a fresh clone has
  // none, and a sweep there would rewrite every figure as "new", never run
  // pngDiffFraction once, and leave a push reporting the whole corpus as
  // changed. Nothing downstream could tell that from a run where the app really
  // did move everything.
  //
  // It refuses rather than pulling: a sweep is long and expensive, and silently
  // going to the network at minute zero is not something to do on the user's
  // behalf. `pnpm screenshots` pulls first, but website/CLAUDE.md tells people
  // to run the generator directly with node (npx tsx breaks page.evaluate), so
  // the guard cannot live only in the npm script.
  //
  // Scoped to THIS RUN's own outputs rather than the whole manifest. An absent
  // figure only matters to a capture about to overwrite it, and scoping it that
  // way is what lets a `--filter` run work in a worktree whose figure directory
  // is shared with another: a figure some other branch deleted is not on disk,
  // is not in that branch's lock, and has nothing to do with the two specs being
  // re-rendered here. Unscoped, it stopped the run outright. A figure absent
  // from the manifest is a genuinely new spec and is not counted.
  const manifest = readManifest()
  const willWrite = new Set(filteredSpecs.flatMap(manifestPathsFor))
  const absent = [...manifest.keys()].filter(
    p => willWrite.has(p) && !fileExists(p),
  )
  if (absent.length > 0) {
    console.error(
      `${absent.length} of this run's ${willWrite.size} output(s) are not on ` +
        'disk, so the diff gate cannot compare against them and every capture ' +
        `would be written as new:\n${absent
          .map(p => `  - ${p}`)
          .join('\n')}\n  Run \`pnpm figures:pull\` first.`,
    )
    process.exit(1)
  }

  console.log(
    `Generating ${filteredSpecs.length} screenshot(s)${filterTokens.length ? ` (filter: ${filterTokens.join(',')})` : ''}`,
  )
  if (impliedCompose.length > 0) {
    console.log(
      `  + recomposing ${impliedCompose.map(s => s.name).join(', ')} (their parts are in this run)`,
    )
  }
  return filteredSpecs
}
