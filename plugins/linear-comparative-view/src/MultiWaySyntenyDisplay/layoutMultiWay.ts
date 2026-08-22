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
// the row order is stable under pans that keep the same gene set
export function rowAssembliesOf(groups: MultiWayGroup[]) {
  const out: string[] = []
  for (const group of groups) {
    for (const assemblyName of group.mates.keys()) {
      if (!out.includes(assemblyName)) {
        out.push(assemblyName)
      }
    }
  }
  return out
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
  return {
    refName: dominant,
    min: min - pad,
    max: max + pad,
    flipped: orientation < 0,
  }
}

export function rowFrameX(frame: RowFrame, bp: number, width: number) {
  const t = (bp - frame.min) / (frame.max - frame.min)
  return frame.flipped ? width * (1 - t) : width * t
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
