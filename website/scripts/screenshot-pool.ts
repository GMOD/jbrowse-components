// Runs the selected specs: CONCURRENCY browsers over the render specs, then
// the compose specs in order, since they stack the render specs' fresh PNGs.
import fs from 'node:fs'
import path from 'node:path'

import { pngDiffFraction, trailingBackgroundPx } from './image-pipeline.ts'
import { rendererFor, specThreshold } from './screenshot-modes.ts'
import {
  CONCURRENCY,
  SLACK_WARN_PX,
  check,
  outDir,
} from './screenshot-options.ts'
import { pct } from './screenshot-report.ts'

import type { CommitResult } from './image-pipeline.ts'
import type { RunTotals } from './screenshot-report.ts'
import type { ScreenshotSpec } from './screenshot-specs.ts'

type Outcome =
  | { kind: 'failed'; error: string }
  | { kind: 'checked'; frac: number | null; flaky: boolean }
  | { kind: 'committed'; result: CommitResult; slackPx: number | null }

// --check: two renders of one spec compared to each other. A drift past the
// threshold is a nondeterministic spec, which would churn its PNG every regen.
async function renderTwice(spec: ScreenshotSpec) {
  const { render } = rendererFor(spec)
  const captures: string[] = []
  try {
    for (const suffix of ['-a', '-b']) {
      captures.push(await render(spec, suffix))
    }
    return pngDiffFraction(captures[0]!, captures[1]!)
  } finally {
    for (const f of captures) {
      fs.rmSync(f, { force: true })
    }
  }
}

async function renderAndCommit(spec: ScreenshotSpec): Promise<Outcome> {
  const { render, commit } = rendererFor(spec)
  const result = commit(spec, await render(spec, ''))
  // Only for an image this run wrote: slack is news when it appears, and much
  // of the committed corpus has some on purpose.
  const slackPx =
    result.status === 'kept'
      ? null
      : await trailingBackgroundPx(path.join(outDir, `${spec.name}.png`))
  return { kind: 'committed', result, slackPx }
}

async function runSpec(
  spec: ScreenshotSpec,
  progress: () => string,
  failures: RunTotals['failures'],
): Promise<Outcome> {
  const brokenParts =
    spec.mode === 'compose'
      ? spec.parts.filter(p => failures.some(f => f.name === p))
      : []
  if (brokenParts.length > 0) {
    const error = `part(s) failed to render this run: ${brokenParts.join(', ')} — not restacking a figure from stale parts`
    console.error(`${progress()} ✗ ${spec.name}: ${error}`)
    return { kind: 'failed', error }
  }
  console.log(`${progress()} → ${spec.name}`)
  try {
    if (!check) {
      return await renderAndCommit(spec)
    }
    const frac = await renderTwice(spec)
    const flaky = frac === null || frac >= specThreshold(spec)
    if (flaky) {
      const drift = frac === null ? 'size-mismatch' : pct(frac)
      console.log(`  ✗ ${spec.name} FLAKY (${drift} between two renders)`)
    } else {
      console.log(`  ✓ ${spec.name} stable (${pct(frac)})`)
    }
    return { kind: 'checked', frac, flaky }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${spec.name}: ${error}`)
    return { kind: 'failed', error }
  }
}

function record(totals: RunTotals, name: string, outcome: Outcome) {
  if (outcome.kind === 'failed') {
    totals.failed++
    totals.failures.push({ name, error: outcome.error })
    return
  }
  totals.passed++
  if (outcome.kind === 'checked') {
    if (outcome.flaky) {
      totals.flaky.push({ name, frac: outcome.frac ?? 1 })
    }
  } else if (outcome.result.status === 'kept') {
    totals.kept++
    if (outcome.result.raisedGate) {
      totals.suppressed.push({ name, frac: outcome.result.frac })
    }
  } else {
    totals.changed.push({ name, result: outcome.result })
    if (outcome.slackPx !== null && outcome.slackPx > SLACK_WARN_PX) {
      totals.slacked.push({ name, px: outcome.slackPx })
    }
  }
}

// `[ 7/40]`, padded so the interleaved per-worker lines stay aligned
function counter(total: number) {
  let started = 0
  return () => {
    started += 1
    return `[${String(started).padStart(String(total).length)}/${total}]`
  }
}

export async function runPool(
  renderSpecs: ScreenshotSpec[],
  composeSpecs: ScreenshotSpec[],
) {
  const totals: RunTotals = {
    passed: 0,
    failed: 0,
    kept: 0,
    selected: [...renderSpecs, ...composeSpecs].map(s => s.name),
    failures: [],
    flaky: [],
    changed: [],
    suppressed: [],
    slacked: [],
  }
  const progress = counter(renderSpecs.length + composeSpecs.length)
  const run = async (spec: ScreenshotSpec) => {
    record(totals, spec.name, await runSpec(spec, progress, totals.failures))
  }

  console.log(`Running with concurrency ${CONCURRENCY}`)
  const queue = [...renderSpecs]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        await run(queue.shift()!)
      }
    }),
  )
  for (const spec of composeSpecs) {
    await run(spec)
  }
  return totals
}
