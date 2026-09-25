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

function aggregateR(
  s: Extract<Step, { type: 'aggregate' }>,
  columns: string[],
  previousBin: string[] | undefined,
): Applied {
  const groupby = s.groupby?.length ? s.groupby : (previousBin ?? [])
  const ops = (s.ops ?? []).filter(o => AGGREGATE_R[o.op ?? 'count'])
  const keys = groupby.map(g => `${g} = g$${g}[1]`)
  const values = ops.map(o => {
    const name = o.as || o.op || 'count'
    return `${name} = ${AGGREGATE_R[o.op ?? 'count']!(o.field ?? '')}`
  })
  return {
    statements: `df <- do.call(rbind, lapply(
  split(df, df[c(${groupby.map(g => rStr(g)).join(', ')})], drop = TRUE),
  function(g) data.frame(${[...keys, ...values].join(', ')})))`,
    columns: [...groupby, ...ops.map(o => o.as || o.op || 'count')],
  }
}

function coverageR(s: Extract<Step, { type: 'coverage' }>): Applied {
  const as = s.as ?? 'coverage'
  return {
    statements: `df <- local({
  runs <- rle(as.vector(IRanges::coverage(IRanges(df$start + 1L, df$end))))
  ends <- cumsum(runs$lengths)
  data.frame(start = c(0L, head(ends, -1L)), end = ends, ${as} = runs$values)
})`,
    columns: ['start', 'end', as],
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
}: {
  base: RFrame
  steps: readonly Step[]
  notes: string[]
}): RFrame {
  let columns: string[] = base.columns.slice()
  const packages = new Set(base.packages)
  const parts: string[] = []
  let lastBin: string[] | undefined
  for (const step of steps) {
    let applied: Applied | undefined
    if (step.type === 'bin') {
      applied = binR(step, columns)
      lastBin = step.as ?? ['start', 'end']
    } else if (step.type === 'aggregate') {
      applied = aggregateR(step, columns, lastBin)
    } else if (step.type === 'coverage') {
      applied = coverageR(step)
    } else if (step.type === 'pileup') {
      applied = pileupR(step, columns)
    } else if (step.type === 'formula') {
      notes.push(`transform: ${step.type} carries a jexl callback, not drawn`)
      const as = step.as ?? 'value'
      if (!columns.includes(as)) {
        columns.push(as)
      }
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
  return frame({
    name: base.name,
    columns,
    packages: [...packages],
    statements: [base.statements, ...parts].join('\n'),
  })
}
