import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { LD_FIELD, LD_ROLE_FIELD } from '../GWASAdapter/ldFields.ts'

import type {
  MarkConfig,
  MarkSnapshot,
  MarkTransformStepConfig,
  StepSnapshot,
} from '@jbrowse/plugin-marks'

/** LocusZoom.js's r² cuts and the palette of the five bins between them. */
const LD_DOMAIN = ['0.2', '0.4', '0.6', '0.8']
const LD_PALETTE = ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a']

/**
 * A partner's color: its r² to the index SNP in LocusZoom's bins, the key
 * listing them highest first as LocusZoom does.
 */
export const LD_COLOR = {
  field: LD_FIELD,
  scale: { type: 'threshold' as const, domain: LD_DOMAIN, range: LD_PALETTE },
  legend: {
    title: 'r² to index SNP',
    descending: true,
    missingLabel: 'No LD data',
  },
}

/** A Manhattan plot's one mark: a point per feature at its `score`. */
export const MANHATTAN_MARK = {
  mark: 'point',
  encoding: { y: 'score' },
} satisfies MarkSnapshot

/** The index SNP's color, apart from every r² bin. */
export const LD_INDEX_COLOR = '#c951c9'

// jexl, since a mark's `filter` step takes no field predicate and the partners'
// test needs ADR-238's unbuilt `not`. Measured 2026-10-26 over a million BED
// features: this filter ~200 ms warm, a compiled predicate ~25 ms
const LD_PARTNERS_FILTER = {
  type: 'filter' as const,
  expr: `jexl:feature.${LD_ROLE_FIELD} != 'index'`,
}

const LD_INDEX_FILTER = {
  type: 'filter' as const,
  expr: `jexl:feature.${LD_ROLE_FIELD} == 'index'`,
}

const LD_INDEX_SHAPE = {
  field: LD_ROLE_FIELD,
  scale: { domain: ['index'], range: ['diamond'], names: ['Index SNP'] },
  legend: { title: '' },
}

/**
 * LocusZoom's plot: what "Color by LD to index SNP" makes of the default one.
 * Every point but the index is colored by its r² to it, and a SNP the join
 * left out has no `ld_role`, so the filter keeps it, grey as "No LD data";
 * the index alone draws over them as a diamond in its own color, with its
 * own key row.
 */
export const LD_MARKS = [
  partnersOf(MANHATTAN_MARK),
  indexTwinOf(MANHATTAN_MARK),
]

const LD_FIELDS = new Set<unknown>([LD_FIELD, LD_ROLE_FIELD])

/** Channels that draw their field itself, rather than style a mark by it. */
const PLOTTING_CHANNELS = new Set(['x', 'y', 'row', 'text'])

function fieldOf(channel: unknown) {
  return typeof channel === 'object' && channel !== null && 'field' in channel
    ? channel.field
    : channel
}

function valueOf(channel: unknown) {
  return typeof channel === 'object' && channel !== null && 'value' in channel
    ? channel.value
    : undefined
}

function ldChannels({ encoding }: MarkSnapshot) {
  return Object.entries(encoding ?? {})
    .filter(([, channel]) => LD_FIELDS.has(fieldOf(channel)))
    .map(([name]) => name)
}

/** Whether a channel of a mark's encoding reads a field the LD join writes. */
export function readsLd(mark: MarkConfig) {
  return ldChannels(getSnapshot(mark)).length > 0
}

/**
 * Whether a mark draws each SNP at the SNP's own position, so a point of it
 * names a SNP the join can find: its `x` is the start, and every step before
 * it, the display's and the facet's included, only filters or computes a
 * field other than a position. A `bin` moves each start to its bin's, and an
 * `aggregate` or `coverage` draws bins in place of SNPs.
 */
export function placesEachSnp(
  mark: MarkConfig,
  sharedSteps: readonly MarkTransformStepConfig[],
) {
  return (
    mark.encoding.x === 'start' &&
    [...sharedSteps, ...mark.transform].every(
      step =>
        step.type === 'filter' ||
        (step.type === 'formula' && step.as !== 'start' && step.as !== 'end'),
    )
  )
}

const LD_FIELD_IN_EXPR = new RegExp(
  String.raw`\b(${LD_FIELD}|${LD_ROLE_FIELD})\b`,
)

/**
 * Whether anything in a plot's worker request names a field the LD join
 * writes: a field reference that is one, or a `jexl:` expression holding one
 * as a word, in any encoding, step, filter or facet. Wider than `readsLd`,
 * which answers for the marks LD coloring writes and strips.
 */
export function namesLd(request: unknown): boolean {
  return typeof request === 'string'
    ? isJexl(request)
      ? LD_FIELD_IN_EXPR.test(request)
      : LD_FIELDS.has(request)
    : typeof request === 'object' && request !== null
      ? Object.values(request).some(namesLd)
      : false
}

/** Whether LD coloring pairs this mark: a point mark placing each SNP. */
export function colorsByLd(
  mark: MarkConfig,
  sharedSteps: readonly MarkTransformStepConfig[],
) {
  return mark.mark.type === 'point' && placesEachSnp(mark, sharedSteps)
}

function partnersOf(mark: MarkSnapshot): MarkSnapshot {
  const own = mark.encoding?.color?.value
  return {
    ...mark,
    transform: [LD_PARTNERS_FILTER, ...(mark.transform ?? [])],
    encoding: {
      ...mark.encoding,
      color: { ...(own === undefined ? {} : { value: own }), ...LD_COLOR },
    },
  }
}

function indexTwinOf(mark: MarkSnapshot): MarkSnapshot {
  return {
    ...mark,
    transform: [LD_INDEX_FILTER, ...(mark.transform ?? [])],
    encoding: {
      ...mark.encoding,
      color: { value: LD_INDEX_COLOR },
      shape: LD_INDEX_SHAPE,
    },
  }
}

/**
 * The plot colored by r² to the index SNP, or undefined where no mark
 * `colorsByLd`. Each such mark becomes its partners — every point but the
 * index, colored by r², its own constant or callback color kept beside the
 * scale for the way back — and, after the last of them, its index twin: the
 * index alone as a pink diamond, drawn over every point. Every other member
 * and every other mark stays.
 */
export function withLd(
  marks: readonly MarkConfig[],
  sharedSteps: readonly MarkTransformStepConfig[],
): MarkSnapshot[] | undefined {
  const paired = marks.map(m => colorsByLd(m, sharedSteps))
  const last = paired.lastIndexOf(true)
  if (last === -1) {
    return undefined
  }
  const written = marks.map((m): MarkSnapshot => getSnapshot(m))
  const twins = written.filter((_, i) => paired[i]).map(indexTwinOf)
  const colored = written.map((m, i) => (paired[i] ? partnersOf(m) : m))
  return [...colored.slice(0, last + 1), ...twins, ...colored.slice(last + 1)]
}

function sameStep(want: { expr: string }) {
  const bare = (expr: string) => expr.replaceAll(/\s+/g, '')
  return (step: StepSnapshot) =>
    step.type === 'filter' &&
    step.expr !== undefined &&
    bare(step.expr) === bare(want.expr)
}

// Each channel over an LD field falls back to the constant it held beside
// the scale, or goes.
function withoutLdScales(mark: MarkSnapshot): MarkSnapshot {
  const encoding = Object.entries(mark.encoding ?? {}).flatMap(
    ([name, channel]): [string, unknown][] => {
      const own = valueOf(channel)
      return !LD_FIELDS.has(fieldOf(channel))
        ? [[name, channel]]
        : own !== undefined
          ? [[name, { value: own }]]
          : []
    },
  )
  return {
    ...mark,
    transform: mark.transform?.filter(s => !sameStep(LD_PARTNERS_FILTER)(s)),
    encoding: Object.fromEntries(encoding),
  }
}

/**
 * The plot with LD coloring taken off, or undefined where nothing is left,
 * which is the default plot. The index twins go, as does a mark drawing an LD
 * field as its `x`, `y`, `row` or `text`; every other mark loses the partner
 * filter and any scale over an LD field. No mark is left reading LD.
 */
export function withoutLd(
  marks: readonly MarkSnapshot[],
): MarkSnapshot[] | undefined {
  const kept = marks
    .filter(
      m =>
        !m.transform?.some(sameStep(LD_INDEX_FILTER)) &&
        !ldChannels(m).some(c => PLOTTING_CHANNELS.has(c)),
    )
    .map(withoutLdScales)
  return kept.length > 0 ? kept : undefined
}
