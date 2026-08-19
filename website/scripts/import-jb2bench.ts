// Turns a jb2bench result into a measurement record.
//
// jb2bench (github.com/cmdcolin/jb2bench) benchmarks the whole app against
// released builds, and it is a sibling checkout rather than a dependency: its
// corpus is ~750 MB of simulated alignments and none of it exists in CI. So this
// is not an autogen entry. It runs where the data is, writes a record into
// `agent-docs/measurements/`, and the record is committed — after which every
// downstream generator treats it like any other, and CI gates the artifact
// rather than the sibling.
//
//   ~/src/jb2bench/results/*.json  --this-->  agent-docs/measurements/<id>.json
//                                              --generate-measurement-tables-->  the doc
//
// `--check` re-derives and compares WHEN the checkout is present, and exits 0
// saying so when it is not. That is the strongest honest gate: on the machine
// with the data it catches a re-run nobody imported, and elsewhere it cannot
// pretend to.
//
// ## One projection per table, written out
//
// No generic mapper. Each result has its own shape and, more to the point, its
// own reasons a cell is unpublishable — and those are the whole value of
// importing rather than retyping. jb2bench's own zoom-OUT table is the worked
// example: past a byte threshold JBrowse declines the fetch and paints
// "Requested too much data" instead of reads, which is fast and draws nothing,
// so the best-looking number in that table was a refusal to draw. A generic
// mapper would carry it across as a win.
//
// So a projection asserts its own preconditions and throws. Refusing to import
// is the correct outcome for a run that did not measure what it claims.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { check } from './check-utils.ts'
import { measurementsDir } from './measurements.ts'
import { primaryRepoRoot } from './paths.ts'

// Beside the primary checkout, never `repoRoot` — from a worktree that resolves
// to `.claude/worktrees/jb2bench` and finds nothing. Same reason
// `pluginCheckout` exists.
//
// `JB2BENCH` overrides it, for a checkout somewhere else and for the test, which
// points this at a copied result it has mutated. The refusals below are the
// whole reason to import rather than retype, so they need to be exercised
// against a file that actually carries a censored cell.
const jb2bench = process.env.JB2BENCH ?? join(primaryRepoRoot, '..', 'jb2bench')

interface Arm {
  zoomTimeToContentMs: number
  zoomRedrawGapMs: number
  censored: boolean
  allBailed: boolean
  stepsBailed: number
  stepsMeasured: number
}

/**
 * Zoom IN: the new renderer re-projects reads it already holds, so it never
 * goes to the network. Its best case, and the one worth publishing — the zoom
 * OUT table beside it in the same file is mostly refusals to draw, and PAN is
 * the both-arms-refetch comparison.
 */
/** why this arm cannot be published as a timing, or undefined if it can */
function unpublishable(arm: Arm) {
  // A censored cell hit MAX_WAIT and its true figure is larger; a bailed step
  // drew nothing. Either one published as a plain number is a claim the run did
  // not make.
  if (arm.censored) {
    return 'censored at MAX_WAIT'
  }
  if (arm.allBailed || arm.stepsBailed > 0) {
    return `${arm.stepsBailed} step(s) drew nothing`
  }
  if (arm.stepsMeasured === 0) {
    return 'no steps measured'
  }
  return undefined
}

function zoomInRefetch(raw: any) {
  const cases = Object.entries(raw.results as Record<string, any>)
    .filter(([, v]) => v.in)
    .map(([name, v]) => ({ name, arms: v.in as Record<string, Arm> }))
  if (cases.length === 0) {
    throw new Error('interaction.json has no zoom-in results')
  }
  for (const { name, arms } of cases) {
    for (const side of ['new', 'baseline']) {
      const why = arms[side] && unpublishable(arms[side])
      if (why) {
        throw new Error(
          `${name}/${side}: ${why} — this run cannot be published as a timing`,
        )
      }
    }
  }

  // jb2bench serves the version the 2023 paper benchmarked on port 8004 and
  // calls that arm `published`. It is optional there and optional here: the
  // whole matrix is not worth refusing over a column that need not exist, and a
  // 2023 build plausibly runs the deepest long-read case past MAX_WAIT. So the
  // column appears only when every one of its cells is publishable, and its
  // absence leaves the two-column record byte-identical to before.
  const publishedBuild = raw.builds.published as string | undefined
  const publishedRefusals = publishedBuild
    ? cases
        .map(({ name, arms }) => {
          const why = arms.published
            ? unpublishable(arms.published)
            : 'not measured'
          return why ? `${name} (${why})` : undefined
        })
        .filter(x => x !== undefined)
    : ['no published arm in this run']
  const withPublished =
    publishedBuild !== undefined && publishedRefusals.length === 0
  if (publishedBuild && !withPublished) {
    console.log(
      `zoom-in-refetch: dropping the ${publishedBuild} column — ${publishedRefusals.join(', ')}`,
    )
  }
  return {
    id: 'zoom-in-refetch',
    measured: raw.measuredAt.in,
    // Internal on purpose. Putting a released-version comparison on the public
    // page is an editorial decision, not a regeneration.
    published: false,
    source: {
      kind: 'jb2bench',
      from: 'results/interaction.json',
      repro:
        'make interaction, in ~/src/jb2bench, then `node website/scripts/import-jb2bench.ts` here',
      notes: `${raw.loc}, ${raw.builds.new} against ${raw.builds.baseline}${withPublished ? ` and ${publishedBuild}, the version the 2023 paper benchmarked` : ''}. time-to-content is the median wall clock a loading indicator is shown after a zoom before correct content returns; redraw is the longest frame of the GPU redraw. Every cell drew, and none was censored at MAX_WAIT — the importer refuses the file otherwise.`,
    },
    columns: [
      { key: 'case', label: 'case' },
      {
        key: 'currentMs',
        label: raw.builds.new,
        format: 'ms',
        align: 'right',
      },
      {
        key: 'baselineMs',
        label: raw.builds.baseline,
        format: 'ms',
        align: 'right',
      },
      ...(withPublished
        ? [
            {
              key: 'publishedMs',
              label: publishedBuild,
              format: 'ms',
              align: 'right',
            },
          ]
        : []),
      {
        key: 'redrawMs',
        label: 'longest redraw frame',
        format: 'ms',
        align: 'right',
      },
    ],
    rows: cases.map(({ name, arms }) => ({
      values: {
        case: name,
        currentMs: Math.round(arms.new!.zoomTimeToContentMs),
        baselineMs: Math.round(arms.baseline!.zoomTimeToContentMs),
        ...(withPublished
          ? { publishedMs: Math.round(arms.published!.zoomTimeToContentMs) }
          : {}),
        // Rounded to whole milliseconds, as jb2bench's own table writes it. The
        // raw value carries float noise (`16.700000000000728`) that the record
        // would otherwise render to fifteen decimals.
        redrawMs: Math.round(arms.new!.zoomRedrawGapMs),
      },
    })),
  }
}

const IMPORTS = [{ file: 'results/interaction.json', project: zoomInRefetch }]

if (!existsSync(jb2bench)) {
  console.log(
    `no jb2bench checkout at ${jb2bench} — nothing to import. The committed records stand; clone github.com/cmdcolin/jb2bench beside this repo to refresh them.`,
  )
  process.exit(0)
}

const stale: string[] = []
for (const { file, project } of IMPORTS) {
  const source = join(jb2bench, file)
  if (!existsSync(source)) {
    console.error(`${source} not found — has jb2bench moved its results?`)
    process.exit(1)
  }
  const record = project(JSON.parse(readFileSync(source, 'utf8')))
  const path = join(measurementsDir, `${record.id}.json`)
  const next = `${JSON.stringify(record, undefined, 2)}\n`
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== next) {
      stale.push(`${record.id} (from jb2bench ${file})`)
    }
    continue
  }
  writeFileSync(path, next)
  console.log(`wrote ${record.id} from jb2bench ${file}`)
}

if (stale.length > 0) {
  console.error(
    `${stale.length} record(s) behind jb2bench — run \`pnpm import-jb2bench\` and commit:\n${stale.map(s => `  ${s}`).join('\n')}`,
  )
  process.exit(1)
}

if (check) {
  console.log(`${IMPORTS.length} jb2bench record(s) match the checkout`)
}
