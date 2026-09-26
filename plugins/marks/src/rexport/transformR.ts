import { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'

import { autoBinStep } from '../LinearMarkDisplay/autoBin.ts'
import {
  DEFAULT_BIN_AS,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  MATE_FIELDS,
} from '../LinearMarkDisplay/markVocabulary.ts'
import { frame, rIdent, rStr } from './rplot.ts'

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

function binEdges(s: Extract<Step, { type: 'bin' }>): readonly string[] {
  return s.as?.length === 2 ? s.as : DEFAULT_BIN_AS
}

function binR(
  s: Extract<Step, { type: 'bin' }>,
  columns: string[],
  bpPerPx: number,
): Applied {
  const field = rIdent(s.field ?? 'start')
  const [lo, hi] = binEdges(s).map(rIdent) as [string, string]
  const width =
    s.step === 'auto' || s.step === undefined ? autoBinStep(bpPerPx) : s.step
  return {
    statements: `df$${lo} <- floor(df$${field} / ${width}) * ${width}
df$${hi} <- df$${lo} + ${width}`,
    columns: [...new Set([...columns, ...binEdges(s)])],
  }
}

/** The bin field pair a step list leaves behind, which a later empty groupby follows. */
export function lastBinOf(steps: readonly Step[]) {
  let out: readonly string[] | undefined
  for (const s of steps) {
    if (s.type === 'bin') {
      out = binEdges(s)
    }
  }
  return out
}

/**
 * An aggregate keeps the span it folded — `min(start)` to `max(end)` — beside
 * its groupby keys and its ops, as `featureTransforms.ts` does, so a mark can
 * still place the result. An empty `groupby` folds the whole frame into one
 * row, which `split` cannot express: `df[c()]` is an R error, not one group.
 *
 * The keys go through `addNA` because `split` drops a group whose key is NA,
 * where the encoder keys `undefined` as a group of its own.
 */
function aggregateR(
  s: Extract<Step, { type: 'aggregate' }>,
  previousBin: readonly string[] | undefined,
): Applied {
  const groupby = s.groupby?.length ? s.groupby : (previousBin ?? [])
  const ops = (s.ops ?? []).filter(o => AGGREGATE_R[o.op ?? 'count'])
  const names = ops.map(o =>
    aggregateFieldName({ op: o.op ?? 'count', field: o.field, as: o.as }),
  )
  const values = ops.map(
    (o, i) =>
      `${rIdent(names[i]!)} = ${AGGREGATE_R[o.op ?? 'count']!(rIdent(o.field ?? ''))}`,
  )
  const span = [
    ...(groupby.includes('start') ? [] : ['start = min(g$start)']),
    ...(groupby.includes('end') ? [] : ['end = max(g$end)']),
  ]
  const fold = `function(g) data.frame(${[
    ...groupby.map(g => `${rIdent(g)} = g$${rIdent(g)}[1]`),
    ...span,
    ...values,
  ].join(', ')}, check.names = FALSE)`
  return {
    statements: groupby.length
      ? `df <- do.call(rbind, lapply(
  split(df, lapply(df[c(${groupby.map(g => rStr(g)).join(', ')})], addNA), drop = TRUE),
  ${fold}))`
      : `df <- (${fold})(df)`,
    columns: [...new Set([...groupby, 'start', 'end', ...names])],
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
  const as = s.as ?? DEFAULT_COVERAGE_AS
  return {
    statements: `df <- do.call(rbind, lapply(split(df, df$.region), function(g) {
  runs <- IRanges::coverage(${ranges('g', 'start', 'end')}, shift = -min(g$start))
  ends <- cumsum(runLength(runs)) + min(g$start)
  out <- data.frame(
    start = c(min(g$start), head(ends, -1L)), end = ends,
    ${rIdent(as)} = as.integer(runValue(runs)), .region = g$.region[1],
    check.names = FALSE)
  out[out$${rIdent(as)} > 0, ]
}))`,
    columns: ['start', 'end', as, '.region'],
    packages: ['IRanges'],
  }
}

/**
 * A frame's features as 1-based closed IRanges. The end is clamped to the
 * start because `IRanges` refuses a width below zero, and one malformed
 * feature otherwise kills the whole script where the encoder clamps.
 */
function ranges(df: string, lo: string, hi: string, pad = 0) {
  const end = `pmax(${df}$${hi}${pad ? ` + ${pad}` : ''}, ${df}$${lo})`
  return `IRanges(${df}$${lo} + 1L, ${end})`
}

function pileupR(
  s: Extract<Step, { type: 'pileup' }>,
  columns: string[],
): Applied {
  const as = s.as ?? DEFAULT_PILEUP_AS
  const [lo, hi] = (
    s.fields?.length === 2 ? s.fields : DEFAULT_PILEUP_FIELDS
  ).map(rIdent) as [string, string]
  return {
    statements: `df$${rIdent(as)} <- IRanges::disjointBins(
  ${ranges('df', lo, hi, s.padding ?? 0)}) - 1L`,
    columns: [...new Set([...columns, as])],
    packages: ['IRanges'],
  }
}

/**
 * The fields a step list writes, over every list handed in. What a reader
 * must not be asked for: a name a step makes is not in the file, and an
 * all-NA column standing in for it would let the mark draw nothing quietly
 * where `missingColumns` should have refused it.
 */
export function stepOutputs(lists: readonly (readonly Step[])[]) {
  const out = new Set<string>()
  for (const step of lists.flat()) {
    if (step.type === 'bin') {
      for (const edge of binEdges(step)) {
        out.add(edge)
      }
    } else if (step.type === 'aggregate') {
      for (const { op = 'count', field, as } of step.ops ?? []) {
        out.add(aggregateFieldName({ op, field, as }))
      }
    } else if (step.type === 'coverage') {
      out.add(step.as ?? DEFAULT_COVERAGE_AS)
    } else if (step.type === 'pileup') {
      out.add(step.as ?? DEFAULT_PILEUP_AS)
    } else if (step.type === 'formula') {
      out.add(step.as ?? DEFAULT_FORMULA_AS)
    } else if (step.type === 'flatten') {
      if (step.index) {
        out.add(step.index)
      }
    } else if (step.type === 'mate') {
      for (const f of MATE_FIELDS) {
        out.add(f)
      }
    }
  }
  return out
}

/**
 * The transform stage as R, and the columns the frame then has.
 *
 * `bin`, `aggregate`, `coverage` and `pileup` state a rule over rows and become
 * base R. `filter` and `formula` carry a jexl callback, and `flatten` and
 * `mate` fan out structure a flat frame does not hold — each is reported rather
 * than approximated, so the figure never silently shows unfiltered data.
 *
 * `within` runs the steps over each value of a field alone, which is what the
 * facet's own steps do: a `pileup` there packs each section on its own rows.
 */
export function applyTransforms({
  base,
  steps,
  notes,
  name,
  inheritedBin,
  bpPerPx,
  within,
}: {
  base: RFrame
  steps: readonly Step[]
  notes: string[]
  /** A name of its own where the steps change what the frame holds. */
  name?: string
  /** The bin a step list above this one left, which an empty groupby follows. */
  inheritedBin?: readonly string[]
  /** The zoom an `auto` bin follows: the figure's width over the regions'. */
  bpPerPx: number
  /** A field whose every value the steps run over separately. */
  within?: string
}): RFrame {
  let columns: string[] = base.columns.slice()
  const packages = new Set(base.packages)
  const parts: string[] = []
  let lastBin = inheritedBin
  for (const step of steps) {
    let applied: Applied | undefined
    if (step.type === 'bin') {
      applied = binR(step, columns, bpPerPx)
      lastBin = binEdges(step)
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
        `transform: formula writes ${step.as ?? DEFAULT_FORMULA_AS} from a jexl callback, which has no R counterpart`,
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
  const steps_ = within
    ? [
        `df <- do.call(rbind, lapply(split(df, addNA(df$${rIdent(within)}), drop = TRUE), function(df) {
key <- df$${rIdent(within)}[1]
${parts.join('\n')}
df$${rIdent(within)} <- key
df
}))`,
      ]
    : parts
  const body = [...rebind, ...steps_.map(s => s.replaceAll(/\bdf\b/g, out))]
  return frame({
    name: out,
    columns: within ? [...new Set([...columns, within])] : columns,
    packages: [...packages],
    statements: body.join('\n'),
    parent: base,
  })
}
