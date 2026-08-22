import type { Feature } from '@jbrowse/core/util'

export interface MultiWayPlacement {
  refName: string
  start: number
  end: number
  strand: number
  name: string
}

export interface MultiWayGroup {
  key: string
  name: string
  anchor: MultiWayPlacement
  mates: Map<string, MultiWayPlacement[]>
  feature: Feature
}

export interface RowFrame {
  refName: string
  min: number
  max: number
  flipped: boolean
}

interface MatePlacement extends MultiWayPlacement {
  assemblyName: string
}

function mateOf(feature: Feature) {
  return feature.get('mate') as MatePlacement
}

// The cross-assembly identity the placements group on: the gene name, falling
// back to the adapter's syntenyId for sources that carry no names. Name first
// because an MCScan blocks adapter keeps the FIRST row naming a gene pair, so
// one anchor gene can surface under different row numbers on different pairs
// while its name is one string everywhere
function groupKeyOf(feature: Feature) {
  const name = feature.get('name')
  if (name !== undefined) {
    return name
  }
  const syntenyId = feature.get('syntenyId')
  return syntenyId === undefined ? feature.id() : String(syntenyId)
}

// One group per anchor gene: the anchor placement plus every mate placement the
// pairwise features name for it. A reference-anchored table repeats a mate
// through each row that reaches it, so placements dedupe on coordinates.
export function groupFeatures(features: Feature[]) {
  const byKey = new Map<string, MultiWayGroup>()
  const seen = new Set<string>()
  for (const feature of features) {
    const key = groupKeyOf(feature)
    const name = feature.get('name') ?? key
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        name,
        anchor: {
          refName: feature.get('refName'),
          start: feature.get('start'),
          end: feature.get('end'),
          strand: feature.get('strand') ?? 0,
          name,
        },
        mates: new Map(),
        feature,
      }
      byKey.set(key, group)
    }
    const mate = mateOf(feature)
    const seenKey = `${key}|${mate.assemblyName}|${mate.refName}|${mate.start}|${mate.end}`
    if (!seen.has(seenKey)) {
      seen.add(seenKey)
      let placements = group.mates.get(mate.assemblyName)
      if (!placements) {
        placements = []
        group.mates.set(mate.assemblyName, placements)
      }
      placements.push({
        refName: mate.refName,
        start: mate.start,
        end: mate.end,
        strand: mate.strand,
        name: mate.name,
      })
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.anchor.refName.localeCompare(b.anchor.refName) ||
      a.anchor.start - b.anchor.start,
  )
}

// Mate assemblies in first-appearance order over the anchor-sorted groups, so
// the row order is stable under pans that keep the same gene set. A non-empty
// `preferred` (the display's rowOrder property) pins the lanes it names to the
// top, in its order; lanes it does not name follow in first-appearance order.
export function rowAssembliesOf(groups: MultiWayGroup[], preferred: string[]) {
  const present: string[] = []
  for (const group of groups) {
    for (const assemblyName of group.mates.keys()) {
      if (!present.includes(assemblyName)) {
        present.push(assemblyName)
      }
    }
  }
  return [
    ...preferred.filter(assemblyName => present.includes(assemblyName)),
    ...present.filter(assemblyName => !preferred.includes(assemblyName)),
  ]
}

function mid(p: MultiWayPlacement) {
  return (p.start + p.end) / 2
}

// The row's own coordinate frame: the dominant refName among the visible
// groups' placements, the padded bp span those placements cover, and whether
// the row reads back-to-front relative to the anchor's gene order. This is what
// makes the display non-reference-anchored — each row is laid out in its own
// frame and only the ribbons carry the correspondence.
export function computeRowFrame(
  groups: MultiWayGroup[],
  assemblyName: string,
  minSpanBp = 0,
): RowFrame | undefined {
  const byRef = new Map<string, MultiWayPlacement[]>()
  for (const group of groups) {
    for (const p of group.mates.get(assemblyName) ?? []) {
      let bucket = byRef.get(p.refName)
      if (!bucket) {
        bucket = []
        byRef.set(p.refName, bucket)
      }
      bucket.push(p)
    }
  }
  let dominant: string | undefined
  let dominantCount = 0
  for (const [refName, placements] of byRef) {
    if (placements.length > dominantCount) {
      dominant = refName
      dominantCount = placements.length
    }
  }
  if (dominant === undefined) {
    return undefined
  }
  const placements = byRef.get(dominant)!
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  let orientation = 0
  let prev: number | undefined
  for (const group of groups) {
    const p = group.mates.get(assemblyName)?.find(m => m.refName === dominant)
    if (p) {
      const m = mid(p)
      if (prev !== undefined) {
        orientation += Math.sign(m - prev)
      }
      prev = m
    }
  }
  const pad = Math.max((max - min) * 0.02, 1)
  let lo = min - pad
  let hi = max + pad
  // a sparse lane never zooms in past the anchor's own scale: a lone ortholog
  // stretched across the full viewport reads as a block, not a gene
  if (hi - lo < minSpanBp) {
    const center = (lo + hi) / 2
    lo = center - minSpanBp / 2
    hi = center + minSpanBp / 2
  }
  return {
    refName: dominant,
    min: lo,
    max: hi,
    flipped: orientation < 0,
  }
}

export function rowFrameX(frame: RowFrame, bp: number, width: number) {
  const t = (bp - frame.min) / (frame.max - frame.min)
  return frame.flipped ? width * (1 - t) : width * t
}

// What a lane draws from a gene track's top-level features. An NCBI-style
// GFF3 also carries a `region` row spanning the whole sequence, which would
// paint the lane end to end; prefer the gene-typed features, and fall back to
// everything that is not a whole-sequence container for annotations whose
// top level is transcripts.
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(features: Feature[]) {
  const genes = features.filter(f => !!f.get('type')?.endsWith('gene'))
  return genes.length
    ? genes
    : features.filter(f => {
        const type = f.get('type')
        return type === undefined || !CONTAINER_TYPES.has(type)
      })
}

// Every exon interval under a gene feature, merged across its transcripts. A
// feature with no exon subfeatures falls back to its CDS structure, and one
// with neither is its own single interval, so a plain BED-backed feature still
// draws as a box.
export function mergedExonIntervals(feature: Feature) {
  const exons: [number, number][] = []
  const cds: [number, number][] = []
  const walk = (f: Feature) => {
    for (const sub of f.get('subfeatures') ?? []) {
      const type = sub.get('type')
      if (type === 'exon') {
        exons.push([sub.get('start'), sub.get('end')])
      } else if (type === 'CDS') {
        cds.push([sub.get('start'), sub.get('end')])
      }
      walk(sub)
    }
  }
  walk(feature)
  const intervals = exons.length ? exons : cds
  if (intervals.length === 0) {
    return [[feature.get('start'), feature.get('end')] as [number, number]]
  }
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

// The group's merged [x1, x2] px span on one row, or undefined when the group
// has nothing on that row's dominant refName — which is what makes a ribbon
// skip a row rather than draw to nowhere
export function groupSpanOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
) {
  const placements = group.mates
    .get(assemblyName)
    ?.filter(p => p.refName === frame.refName)
  if (!placements?.length) {
    return undefined
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  const a = rowFrameX(frame, min, width)
  const b = rowFrameX(frame, max, width)
  return a < b ? ([a, b] as const) : ([b, a] as const)
}
