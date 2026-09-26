import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'

import { frame, rStr } from './rplot.ts'

import type { RFrame } from './rplot.ts'

/**
 * A declared transform step, as `marks[].transform` and the display's own
 * `transform` hold one. Every arm carries only its own slots (ADR-150), so the
 * translation is one arm per step kind and a new step kind is one more.
 */
export type Step =
  | { type: 'filter'; expr?: string }
  | { type: 'formula'; expr?: string; as?: string }
  | { type: 'bin'; step?: number | 'auto'; field?: string; as?: string[] }
  | {
      type: 'aggregate'
      groupby?: string[]
      ops?: { op?: string; field?: string; as?: string }[]
    }
  | { type: 'coverage'; as?: string }
  | { type: 'flatten'; field?: string; index?: string; keepEmpty?: boolean }
  | { type: 'pileup'; as?: string; fields?: string[]; padding?: number }
  | { type: 'mate' }

const AGGREGATE_R: Record<string, (field: string) => string> = {
  count: () => 'nrow(g)',
  sum: f => `sum(g$${f}, na.rm = TRUE)`,
  mean: f => `mean(g$${f}, na.rm = TRUE)`,
  min: f => `min(g$${f}, na.rm = TRUE)`,
  max: f => `max(g$${f}, na.rm = TRUE)`,
}

interface Applied {
  statements: string
  columns: string[]
  packages?: string[]
}

function binR(s: Extract<Step, { type: 'bin' }>, columns: string[]): Applied {
  const field = s.field ?? 'start'
  const [lo = 'start', hi = 'end'] = s.as ?? ['start', 'end']
  const width = s.step === 'auto' || s.step === undefined ? 10000 : s.step
  return {
    statements: `df$${lo} <- floor(df$${field} / ${width}) * ${width}
df$${hi} <- df$${lo} + ${width}`,
    columns: [...new Set([...columns, lo, hi])],
  }
}

/** The bin field pair a step list leaves behind, which a later empty groupby follows. */
export function lastBinOf(steps: readonly Step[]) {
  let out: string[] | undefined
  for (const s of steps) {
    if (s.type === 'bin') {
      out = s.as ?? ['start', 'end']
    }
  }
  return out
}

/**
 * An aggregate keeps the span it folded — `min(start)` to `max(end)` — beside
 * its groupby keys and its ops, as `featureTransforms.ts` does, so a mark can
 * still place the result. An empty `groupby` folds the whole frame into one
 * row, which `split` cannot express: `df[c()]` is an R error, not one group.
 */
function aggregateR(
  s: Extract<Step, { type: 'aggregate' }>,
  previousBin: string[] | undefined,
): Applied {
  const groupby = s.groupby?.length ? s.groupby : (previousBin ?? [])
  const ops = (s.ops ?? []).filter(o => AGGREGATE_R[o.op ?? 'count'])
  const names = ops.map(o =>
    aggregateFieldName({ op: o.op ?? 'count', field: o.field, as: o.as }),
  )
  const values = ops.map(
    (o, i) => `${names[i]} = ${AGGREGATE_R[o.op ?? 'count']!(o.field ?? '')}`,
  )
  const fold = `function(g) data.frame(${[
    ...groupby.map(g => `${g} = g$${g}[1]`),
    'start = min(g$start), end = max(g$end)',
    ...values,
  ].join(', ')})`
  return {
    statements: groupby.length
      ? `df <- do.call(rbind, lapply(
  split(df, df[c(${groupby.map(g => rStr(g)).join(', ')})], drop = TRUE),
  ${fold}))`
      : `df <- (${fold})(df)`,
    columns: [...groupby, 'start', 'end', ...names],
  }
}

/**
 * Depth as intervals, read off the Rle rather than an expanded vector.
 *
 * `as.vector()` on the coverage expands to an integer per base from position 1,
 * so a feature at chr1:150 Mb materialised a 600 MB vector and took 11.7 s.
 * The run-length encoding already is the interval list, shifted by the offset
 * the ranges start at.
 *
 * Depth-0 runs are dropped, as `featureTransforms.ts` drops them, and
 * `.region` is carried so a multi-region figure still separates.
 */
function coverageR(s: Extract<Step, { type: 'coverage' }>): Applied {
  const as = s.as ?? 'coverage'
  return {
    statements: `df <- do.call(rbind, lapply(split(df, df$.region), function(g) {
  runs <- IRanges::coverage(IRanges(g$start + 1L, g$end), shift = -min(g$start))
  ends <- cumsum(runLength(runs)) + min(g$start)
  out <- data.frame(
    start = c(min(g$start), head(ends, -1L)), end = ends,
    ${as} = as.integer(runValue(runs)), .region = g$.region[1])
  out[out$${as} > 0, ]
}))`,
    columns: ['start', 'end', as, '.region'],
    packages: ['IRanges'],
  }
}

function pileupR(
  s: Extract<Step, { type: 'pileup' }>,
  columns: string[],
): Applied {
  const as = s.as ?? 'row'
  const [lo = 'start', hi = 'end'] = s.fields ?? ['start', 'end']
  const pad = s.padding ?? 0
  return {
    statements: `df$${as} <- IRanges::disjointBins(
  IRanges(df$${lo} + 1L, df$${hi}${pad ? ` + ${pad}` : ''})) - 1L`,
    columns: [...new Set([...columns, as])],
    packages: ['IRanges'],
  }
}

/**
 * The transform stage as R, and the columns the frame then has.
 *
 * `bin`, `aggregate`, `coverage` and `pileup` state a rule over rows and become
 * base R. `filter` and `formula` carry a jexl callback, and `flatten` and
 * `mate` fan out structure a flat frame does not hold — each is reported rather
 * than approximated, so the figure never silently shows unfiltered data.
 */
export function applyTransforms({
  base,
  steps,
  notes,
  name,
  inheritedBin,
}: {
  base: RFrame
  steps: readonly Step[]
  notes: string[]
  /** A name of its own where the steps change what the frame holds. */
  name?: string
  /** The bin a step list above this one left, which an empty groupby follows. */
  inheritedBin?: string[]
}): RFrame {
  let columns: string[] = base.columns.slice()
  const packages = new Set(base.packages)
  const parts: string[] = []
  let lastBin = inheritedBin
  for (const step of steps) {
    let applied: Applied | undefined
    if (step.type === 'bin') {
      applied = binR(step, columns)
      lastBin = step.as ?? ['start', 'end']
    } else if (step.type === 'aggregate') {
      applied = aggregateR(step, lastBin)
    } else if (step.type === 'coverage') {
      applied = coverageR(step)
    } else if (step.type === 'pileup') {
      applied = pileupR(step, columns)
    } else if (step.type === 'formula') {
      // No column: a formula emits no R, so claiming its output would let a
      // mark name a field the script never writes and die at draw time.
      notes.push(
        `transform: formula writes ${step.as ?? 'value'} from a jexl callback, which has no R counterpart`,
      )
    } else {
      notes.push(
        step.type === 'filter'
          ? 'transform: filter carries a jexl callback, so the figure shows unfiltered rows'
          : `transform: ${step.type} needs structure a table does not hold, not drawn`,
      )
    }
    if (applied) {
      parts.push(applied.statements)
      columns = applied.columns
      for (const p of applied.packages ?? []) {
        packages.add(p)
      }
    }
  }
  if (!parts.length) {
    return base
  }
  // A renamed frame rebinds itself first, so its steps read the new name and
  // the frame it derives from stays intact for the marks still reading that.
  const out = name ?? base.name
  // The rebind names both frames, so it is written directly and never goes
  // through the rename — `df_1 <- df` became `df_1 <- df_1`, assigning from a
  // binding that did not exist yet.
  const rebind = out === base.name ? [] : [`${out} <- ${base.name}`]
  const body = [...rebind, ...parts.map(s => s.replaceAll(/\bdf\b/g, out))]
  return frame({
    name: out,
    columns,
    packages: [...packages],
    statements: body.join('\n'),
    parent: base,
  })
}
