import { aggregateFieldName } from './aggregateFieldName.ts'
import { categoricalField } from './categoricalField.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'
import SimpleFeature, { buildJexlContext } from './simpleFeature.ts'
import { junctionEnds, svTypeOfAlt } from './svAlt.ts'

import type { JexlInstance } from './jexlStrings.ts'
import type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CoverageStep,
  FacetSection,
  FacetSpec,
  FieldRef,
  FlattenStep,
  PileupStep,
  TransformStep,
} from './markEncodingTypes.ts'
import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'

export const DEFAULT_BIN_FIELD = 'start'
export const DEFAULT_BIN_AS: [string, string] = ['start', 'end']
export const DEFAULT_FLATTEN_FIELD = 'subfeatures'
export const DEFAULT_COVERAGE_AS = 'coverage'
export const DEFAULT_PILEUP_AS = 'row'
export const DEFAULT_PILEUP_FIELDS: [string, string] = ['start', 'end']

/**
 * A feature with fields written over another's: what `formula` and `bin`
 * produce, without copying the base feature's data per step.
 *
 * Each class here spells `get` as a prototype method with the interface's
 * overloads restated: a class-field arrow allocates a closure per instance,
 * one more allocation beside the object for every feature a step answers.
 */
class DerivedFeature implements Feature {
  private readonly base: Feature
  private readonly fields: Record<string, unknown>
  private readonly ownId: string | undefined

  constructor(base: Feature, fields: Record<string, unknown>, id?: string) {
    this.base = base
    this.fields = fields
    this.ownId = id
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    return name in this.fields ? this.fields[name] : this.base.get(name)
  }

  id() {
    return this.ownId ?? this.base.id()
  }

  parent() {
    return this.base.parent?.()
  }

  children() {
    return this.base.children?.()
  }

  toJSON(): SimpleFeatureSerialized {
    return { ...this.base.toJSON(), ...this.fields }
  }
}

/**
 * A feature a step made from nothing: what `aggregate` and `coverage` answer,
 * carrying only the fields they wrote. `SimpleFeature`'s constructor costs
 * more than the encode of what it builds, and nothing here needs its checks.
 */
class MadeFeature implements Feature {
  private readonly data: Record<string, unknown>
  private readonly tag: string

  constructor(data: Record<string, unknown>, tag: string) {
    this.data = data
    this.tag = tag
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    return name === 'uniqueId' ? this.id() : this.data[name]
  }

  id() {
    const { refName, start, end } = this.data
    return `${String(refName)}:${String(start)}-${String(end)}${this.tag}`
  }

  toJSON(): SimpleFeatureSerialized {
    return { ...this.data, uniqueId: this.id() } as SimpleFeatureSerialized
  }
}

function expression(expr: string, jexl: JexlInstance | undefined) {
  if (!jexl) {
    throw new Error(`a jexl transform needs a jexl instance (${expr})`)
  }
  return stringToJexlExpression(expr, jexl)
}

// A step reads a name or a dotted path. A plain name keeps the direct
// `f.get` its loop has always made; this is the reader a path takes instead,
// chosen once per step. A computed field is a `formula` step's to make.
function pathReader(ref: string, step: string) {
  if (isJexl(ref)) {
    throw new Error(
      `${step} field is a name or a dotted path, and a formula step in front computes one (${ref})`,
    )
  }
  return fieldReader(ref, undefined)
}

// A list holding one value is that value, as a VCF's ALT and INFO fields
// arrive, and a longer one is its text: a Map keys a list by identity, which
// made every feature a group of its own. A missing value is one group, whether
// the field is absent or holds a VCF's `.`.
function groupKey(value: unknown): unknown {
  return Array.isArray(value)
    ? value.length === 1
      ? (value[0] ?? undefined)
      : value.join(',')
    : (value ?? undefined)
}

function filter(
  features: readonly Feature[],
  expr: string,
  jexl: JexlInstance | undefined,
) {
  const compiled = expression(expr, jexl)
  return features.filter(f => compiled.eval(buildJexlContext({ feature: f })))
}

function formula(
  features: readonly Feature[],
  expr: string,
  as: string,
  jexl: JexlInstance | undefined,
) {
  const compiled = expression(expr, jexl)
  return features.map(
    f =>
      new DerivedFeature(f, {
        [as]: compiled.eval(buildJexlContext({ feature: f })),
      }),
  )
}

/**
 * One element of a fanned-out array field, reading its own fields over the
 * feature it came from: an exon that still knows its gene's name and strand.
 */
class FlattenedFeature implements Feature {
  private readonly container: Feature
  private readonly item: Feature

  constructor(container: Feature, item: Feature) {
    this.container = container
    this.item = item
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    const v = this.item.get(name)
    return v === undefined ? this.container.get(name) : v
  }

  id() {
    return this.item.id()
  }

  parent() {
    return this.container
  }

  children() {
    return this.item.children?.()
  }

  toJSON(): SimpleFeatureSerialized {
    return { ...this.container.toJSON(), ...this.item.toJSON() }
  }
}

function flatten(features: readonly Feature[], step: FlattenStep) {
  const { field = DEFAULT_FLATTEN_FIELD, index, keepEmpty } = step
  const out: Feature[] = []
  const read = isPlainFieldRef(field)
    ? undefined
    : pathReader(field, 'a flatten')
  for (const f of features) {
    const items: unknown = read ? read(f) : f.get(field)
    if (!Array.isArray(items) || items.length === 0) {
      if (keepEmpty) {
        out.push(f)
      }
      continue
    }
    for (const [i, item] of items.entries()) {
      const child =
        typeof (item as Feature | undefined)?.get === 'function'
          ? (item as Feature)
          : new SimpleFeature({
              ...(item as Record<string, unknown>),
              uniqueId: `${f.id()}#${i}`,
            } as SimpleFeatureSerialized)
      const flat = new FlattenedFeature(f, child)
      out.push(index ? new DerivedFeature(flat, { [index]: i }) : flat)
    }
  }
  return out
}

interface MateEnd {
  refName: string
  start: number
  end: number
  mateDirection: number
}

function statedMate(f: Feature): MateEnd | undefined {
  const mate = f.get('mate') as Partial<MateEnd> | undefined
  return mate?.refName !== undefined && mate.start !== undefined
    ? {
        refName: mate.refName,
        start: mate.start,
        end: mate.end ?? mate.start + 1,
        mateDirection: mate.mateDirection ?? 0,
      }
    : undefined
}

function mateFields(
  f: Feature,
  alt: string | undefined,
  mate: MateEnd,
  ownDirection: number,
) {
  const info = f.get('INFO') as Record<string, unknown[]> | undefined
  const svtype = info?.SVTYPE?.[0] ?? svTypeOfAlt(alt)
  return {
    mate,
    mateDirection: ownDirection,
    ...(alt === undefined ? {} : { alt }),
    ...(svtype === undefined ? {} : { svtype }),
  }
}

function mates(features: readonly Feature[]) {
  const out: Feature[] = []
  const seen = new Set<string>()
  const admit = (
    f: Feature,
    mate: MateEnd,
    fields: Record<string, unknown>,
    id?: string,
  ) => {
    const here = `${f.get('refName')}:${f.get('start')}-${f.get('end')}`
    const there = `${mate.refName}:${mate.start}-${mate.end}`
    const key = here < there ? `${here}|${there}` : `${there}|${here}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(new DerivedFeature(f, fields, id))
    }
  }
  for (const f of features) {
    const stated = statedMate(f)
    if (stated) {
      const ends = junctionEnds(f)!
      const mate = { ...stated, mateDirection: ends.mate.keeps }
      admit(f, mate, mateFields(f, undefined, mate, ends.own.keeps))
      continue
    }
    const alts = f.get('ALT')
    if (!Array.isArray(alts)) {
      continue
    }
    for (const [i, alt] of (alts as string[]).entries()) {
      const ends = junctionEnds(f, alt)
      if (!ends) {
        continue
      }
      const mate = {
        refName: ends.mate.refName,
        start: ends.mate.pos,
        end: ends.mate.pos + 1,
        mateDirection: ends.mate.keeps,
      }
      admit(
        f,
        mate,
        mateFields(f, alt, mate, ends.own.keeps),
        alts.length > 1 ? `${f.id()}#${i}` : undefined,
      )
    }
  }
  return out
}

function bin(features: readonly Feature[], step: BinStep) {
  const { field = DEFAULT_BIN_FIELD, step: size } = step
  if (!(size > 0)) {
    throw new Error(`a bin step needs a positive size (${size})`)
  }
  const [asStart, asEnd] = step.as ?? DEFAULT_BIN_AS
  if (isPlainFieldRef(field)) {
    return features.map(f => {
      const v = numericValue(f.get(field))
      const start = Math.floor(v / size) * size
      return new DerivedFeature(f, { [asStart]: start, [asEnd]: start + size })
    })
  }
  const read = pathReader(field, 'a bin')
  return features.map(f => {
    const v = numericValue(read(f))
    const start = Math.floor(v / size) * size
    return new DerivedFeature(f, { [asStart]: start, [asEnd]: start + size })
  })
}

// The groups keyed by their raw field values, one Map level per groupby
// field: a string key built per feature was the aggregate's whole cost.
type GroupTrie = Map<unknown, GroupTrie | Feature[]>

function groupMembers(
  features: readonly Feature[],
  groupby: readonly string[],
): Feature[][] {
  if (groupby.length === 0) {
    return features.length > 0 ? [[...features]] : []
  }
  const last = groupby.length - 1
  const root: GroupTrie = new Map()
  const groups: Feature[][] = []
  for (const f of features) {
    let node = root
    for (let i = 0; i < last; i++) {
      const raw = f.get(groupby[i]!)
      const v = typeof raw === 'object' ? groupKey(raw) : raw
      let next = node.get(v) as GroupTrie | undefined
      if (!next) {
        next = new Map()
        node.set(v, next)
      }
      node = next
    }
    const raw = f.get(groupby[last]!)
    const v = typeof raw === 'object' ? groupKey(raw) : raw
    let members = node.get(v) as Feature[] | undefined
    if (!members) {
      members = []
      node.set(v, members)
      groups.push(members)
    }
    members.push(f)
  }
  return groups
}

type Read = (feature: Feature) => unknown

// `groupMembers` over readers, for a groupby naming a dotted path.
function groupMembersBy(
  features: readonly Feature[],
  reads: readonly Read[],
): Feature[][] {
  const last = reads.length - 1
  const root: GroupTrie = new Map()
  const groups: Feature[][] = []
  for (const f of features) {
    let node = root
    for (let i = 0; i < last; i++) {
      const v = groupKey(reads[i]!(f))
      let next = node.get(v) as GroupTrie | undefined
      if (!next) {
        next = new Map()
        node.set(v, next)
      }
      node = next
    }
    const v = groupKey(reads[last]!(f))
    let members = node.get(v) as Feature[] | undefined
    if (!members) {
      members = []
      node.set(v, members)
      groups.push(members)
    }
    members.push(f)
  }
  return groups
}

function keyedGroupby(groupby: readonly string[]) {
  return groupby.some(field => !isPlainFieldRef(field))
}

function aggregate(features: readonly Feature[], step: AggregateStep) {
  const { groupby = [], ops } = step
  const out: Feature[] = []
  let serial = 0
  const reads = keyedGroupby(groupby)
    ? groupby.map(field => pathReader(field, 'an aggregate'))
    : undefined
  const opReads = ops.map(({ op, field }) =>
    op === 'count' || field === undefined || isPlainFieldRef(field)
      ? undefined
      : pathReader(field, 'an aggregate'),
  )
  for (const members of reads
    ? groupMembersBy(features, reads)
    : groupMembers(features, groupby)) {
    const first = members[0]!
    const refName = first.get('refName')
    let start = Infinity
    let end = -Infinity
    for (const m of members) {
      start = Math.min(start, m.get('start'))
      end = Math.max(end, m.get('end'))
    }
    const data: Record<string, unknown> = {}
    for (const [i, field] of groupby.entries()) {
      data[field] = groupKey(reads ? reads[i]!(first) : first.get(field))
    }
    for (const [k, agg] of ops.entries()) {
      const read = opReads[k]
      data[aggregateFieldName(agg)] = read
        ? aggregateValueBy(members, agg.op, read)
        : aggregateValue(members, agg)
    }
    out.push(new MadeFeature({ ...data, refName, start, end }, `#${serial++}`))
  }
  return out
}

function aggregateValue(
  members: readonly Feature[],
  { op, field }: AggregateOp,
) {
  if (op === 'count') {
    return members.length
  }
  if (field === undefined) {
    throw new Error(`an aggregate ${op} needs a field`)
  }
  let sum = 0
  let n = 0
  let min = Infinity
  let max = -Infinity
  for (const m of members) {
    const v = numericValue(m.get(field))
    if (!Number.isFinite(v)) {
      continue
    }
    sum += v
    n++
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  switch (op) {
    case 'sum': {
      return sum
    }
    case 'mean': {
      return n > 0 ? sum / n : undefined
    }
    case 'min': {
      return n > 0 ? min : undefined
    }
    case 'max': {
      return n > 0 ? max : undefined
    }
  }
}

// `aggregateValue` over a reader, for an op naming a dotted path. A function
// of its own, and the fold written out again, so the loop above stays the size
// it was: both variants in one body measured 1.04-1.20x on a plain field.
function aggregateValueBy(
  members: readonly Feature[],
  op: AggregateOp['op'],
  read: Read,
) {
  let sum = 0
  let n = 0
  let min = Infinity
  let max = -Infinity
  for (const m of members) {
    const v = numericValue(read(m))
    if (!Number.isFinite(v)) {
      continue
    }
    sum += v
    n++
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return op === 'sum'
    ? sum
    : n === 0
      ? undefined
      : op === 'mean'
        ? sum / n
        : op === 'min'
          ? min
          : max
}

/**
 * The lowest row each feature fits on, greedy first fit in start order, as a
 * step in front of the encoder rather than a packer behind it. `rowEnds[r]` is
 * where row `r` is free again, so the scan is over rows rather than over
 * features.
 */
function pileup(features: readonly Feature[], step: PileupStep) {
  const as = step.as ?? DEFAULT_PILEUP_AS
  const [startField, endField] = step.fields ?? DEFAULT_PILEUP_FIELDS
  const padding = step.padding ?? 0
  const n = features.length
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  let inOrder = true
  if (isPlainFieldRef(startField) && isPlainFieldRef(endField)) {
    for (let i = 0; i < n; i++) {
      const f = features[i]!
      starts[i] = numericValue(f.get(startField))
      ends[i] = numericValue(f.get(endField))
      inOrder &&= i === 0 || starts[i]! >= starts[i - 1]!
    }
  } else {
    const readStart = pathReader(startField, 'a pileup')
    const readEnd = pathReader(endField, 'a pileup')
    for (let i = 0; i < n; i++) {
      const f = features[i]!
      starts[i] = numericValue(readStart(f))
      ends[i] = numericValue(readEnd(f))
      inOrder &&= i === 0 || starts[i]! >= starts[i - 1]!
    }
  }
  // Any unreadable start leaves the list out of order. Read as Infinity, it
  // sorts last and packs where it claims no row a readable one could want,
  // where NaN left the sort without an order and a row's end unreadable.
  if (!inOrder) {
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(starts[i])) {
        starts[i] = Infinity
      }
    }
  }
  const order = inOrder
    ? undefined
    : Uint32Array.from(starts, (_, i) => i).sort(
        (a, b) => starts[a]! - starts[b]! || a - b,
      )
  const rowEnds: number[] = []
  const out: Feature[] = []
  for (let k = 0; k < n; k++) {
    const i = order ? order[k]! : k
    const start = starts[i]!
    const end = ends[i]!
    let row = 0
    while (row < rowEnds.length && rowEnds[row]! > start) {
      row++
    }
    rowEnds[row] = (end > start ? end : start) + padding
    out.push(new DerivedFeature(features[i]!, { [as]: row }))
  }
  return out
}

/**
 * Piecewise-constant depth over the features' spans: one feature per run of
 * equal depth, where the depth is not zero. A sweep over the sorted edges,
 * so the input need not be sorted.
 */
function coverage(features: readonly Feature[], step: CoverageStep) {
  const as = step.as ?? DEFAULT_COVERAGE_AS
  const spanStarts = new Float64Array(features.length)
  const spanEnds = new Float64Array(features.length)
  let n = 0
  for (const f of features) {
    const start = numericValue(f.get('start'))
    const end = numericValue(f.get('end'))
    if (Number.isFinite(start) && Number.isFinite(end)) {
      spanStarts[n] = start
      spanEnds[n] = end
      n++
    }
  }
  if (n === 0) {
    return []
  }
  const starts = spanStarts.subarray(0, n).sort()
  const ends = spanEnds.subarray(0, n).sort()
  const refName = features[0]!.get('refName')
  const out: Feature[] = []
  let depth = 0
  let runStart = starts[0]!
  let si = 0
  let ei = 0
  let last: Record<string, unknown> | undefined
  const emit = (to: number) => {
    if (depth > 0 && to > runStart) {
      if (last?.end === runStart && last[as] === depth) {
        last.end = to
      } else {
        last = { refName, start: runStart, end: to, [as]: depth }
        out.push(new MadeFeature(last, ''))
      }
    }
  }
  while (si < n || ei < n) {
    const nextStart = si < n ? starts[si]! : Infinity
    const nextEnd = ei < n ? ends[ei]! : Infinity
    const at = Math.min(nextStart, nextEnd)
    emit(at)
    runStart = at
    while (si < n && starts[si] === at) {
      depth++
      si++
    }
    while (ei < n && ends[ei] === at) {
      depth--
      ei++
    }
  }
  return out
}

function rowOf(value: unknown) {
  const row = Number(value)
  return row > 0 ? Math.floor(row) : 0
}

/**
 * #api
 * One layer of a faceted request: its features in section order, and the
 * stacked row of each, index for index.
 */
export interface FacetedLayer {
  features: readonly Feature[]
  rows: readonly number[]
}

/**
 * #api
 * A faceted request's layers: the features split on the facet's field, the
 * facet's own steps and then each layer's run over each section alone, and
 * the sections stacked — a section's rows start where the one above it ends,
 * and it is as tall as the tallest layer packed it. Every layer's features
 * come back in section order beside their stacked rows, so a faceted display
 * is the unfaceted one drawn once per section, and a feature is handed on as
 * its steps left it. A layer naming no `row` field stands on each section's
 * first row, the answer the unfaceted encoder gives it.
 */
export function facetLayers(
  features: readonly Feature[],
  facet: FacetSpec,
  layers: readonly { transform?: readonly TransformStep[]; row?: FieldRef }[],
  jexl?: JexlInstance,
): { layers: FacetedLayer[]; sections: FacetSection[] } {
  const { field, transform: sectionSteps } = facet
  const categories = categoricalField(field)
  const read = fieldReader(field, jexl)
  const byKey = new Map<string, Feature[]>()
  for (const f of features) {
    const key = categories.key(read(f))
    const members = byKey.get(key)
    if (members) {
      members.push(f)
    } else {
      byKey.set(key, [f])
    }
  }
  const readRows = layers.map(l =>
    l.row === undefined ? undefined : fieldReader(l.row, jexl),
  )
  const out = layers.map((): { features: Feature[]; rows: number[] } => ({
    features: [],
    rows: [],
  }))
  const sections: FacetSection[] = []
  let next = 0
  for (const key of [...byKey.keys()].sort(categories.compare)) {
    const members = byKey.get(key)!
    const section = sectionSteps?.length
      ? runTransforms(members, sectionSteps, jexl)
      : members
    let rowCount = 1
    for (const [l, { transform }] of layers.entries()) {
      const placed = transform?.length
        ? runTransforms(section, transform, jexl)
        : section
      const readRow = readRows[l]
      const layer = out[l]!
      for (const f of placed) {
        const row = readRow ? rowOf(readRow(f)) : 0
        if (row + 1 > rowCount) {
          rowCount = row + 1
        }
        layer.features.push(f)
        layer.rows.push(next + row)
      }
    }
    sections.push({ key, firstRow: next, rowCount })
    next += rowCount
  }
  return { layers: out, sections }
}

/**
 * #api
 * Run the transform steps over a feature list, in order, in the worker. The
 * list a step answers is what the next one reads, and the last one is what
 * the encoder walks.
 */
export function runTransforms(
  features: readonly Feature[],
  steps: readonly TransformStep[],
  jexl?: JexlInstance,
): readonly Feature[] {
  let current = features
  for (const step of steps) {
    switch (step.type) {
      case 'filter': {
        current = filter(current, step.expr, jexl)
        break
      }
      case 'formula': {
        current = formula(current, step.expr, step.as, jexl)
        break
      }
      case 'flatten': {
        current = flatten(current, step)
        break
      }
      case 'bin': {
        current = bin(current, step)
        break
      }
      case 'aggregate': {
        current = aggregate(current, step)
        break
      }
      case 'coverage': {
        current = coverage(current, step)
        break
      }
      case 'pileup': {
        current = pileup(current, step)
        break
      }
      case 'mate': {
        current = mates(current)
        break
      }
    }
  }
  return current
}
