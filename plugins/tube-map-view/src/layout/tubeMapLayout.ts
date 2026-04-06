// Tube map layout algorithm ported from sequenceTubeMap (MIT license)
// https://github.com/vgteam/sequenceTubeMap
//
// 5-pass algorithm:
// 1. Node ordering (horizontal position)
// 2. Successor/predecessor mapping
// 3. Lane assignment (track routing)
// 4. Vertical positioning
// 5. X coordinate calculation

import type {
  NodeAssignment,
  PathSegment,
  TubeMapLayout,
  TubeMapNode,
  TubeMapTrack,
} from './types.ts'

const NODE_GAP = 10
const TRACK_WIDTH = 7
const NODE_PADDING = 25
const MIN_NODE_WIDTH = 10

interface InputNode {
  name: string
  sequenceLength: number
  sequence?: string
}

interface InputTrack {
  id: string
  name: string
  segments: { name: string; isForward: boolean }[]
  type: 'haplotype' | 'read'
  indexOfFirstBase: number
}

function absIdx(raw: number) {
  return raw < 0 ? -(raw + 1) : raw
}

export function computeTubeMapLayout(
  inputNodes: InputNode[],
  inputTracks: InputTrack[],
  widthPerBp = 10,
): TubeMapLayout {
  const nodeByName = new Map<string, number>()
  const nodes: TubeMapNode[] = inputNodes.map((n, i) => {
    nodeByName.set(n.name, i)
    return {
      name: n.name,
      sequenceLength: n.sequenceLength,
      sequence: n.sequence,
      order: -1,
      x: 0,
      y: 0,
      pixelWidth: Math.max(n.sequenceLength * widthPerBp, MIN_NODE_WIDTH),
      contentHeight: 0,
      successors: new Set<number>(),
      predecessors: new Set<number>(),
      topLane: 0,
      degree: 0,
    }
  })

  const tracks: TubeMapTrack[] = inputTracks.map(t => {
    const seq = t.segments.map(s => {
      const idx = nodeByName.get(s.name)
      if (idx === undefined) {
        return 0
      }
      return s.isForward ? idx : -(idx + 1)
    })
    return {
      id: t.id,
      name: t.name,
      indexOfFirstBase: t.indexOfFirstBase,
      sequence: seq,
      type: t.type,
      path: [],
    }
  })

  if (nodes.length === 0) {
    return { nodes, tracks, orderToX: new Float64Array(0), maxX: 0, maxY: 0 }
  }

  generateNodeOrder(nodes, tracks)
  generateNodeSuccessors(nodes, tracks)
  const assignments = generateLaneAssignment(nodes, tracks)
  applyVerticalPositions(nodes, tracks, assignments)
  const orderToX = generateNodeXCoords(nodes, tracks)

  let maxX = 0
  let maxY = 0
  for (const node of nodes) {
    const right = node.x + node.pixelWidth
    const bottom = node.y + node.contentHeight
    if (right > maxX) {
      maxX = right
    }
    if (bottom > maxY) {
      maxY = bottom
    }
  }

  return { nodes, tracks, orderToX, maxX, maxY }
}

function maxOrder(nodes: TubeMapNode[]) {
  let max = 0
  for (const n of nodes) {
    if (n.order > max) {
      max = n.order
    }
  }
  return max
}

// Pass 1: assign horizontal order to nodes based on track traversal
function generateNodeOrder(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  let nextOrder = 0

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t]!
    const seq = track.sequence

    if (t === 0) {
      for (const rawIdx of seq) {
        const idx = absIdx(rawIdx)
        if (nodes[idx]!.order === -1) {
          nodes[idx]!.order = nextOrder++
        }
      }
    } else {
      let prevAnchorPos = -1
      let prevAnchorOrder = -1

      for (let s = 0; s < seq.length; s++) {
        const idx = absIdx(seq[s]!)
        const node = nodes[idx]!

        if (node.order !== -1) {
          if (prevAnchorPos !== -1 && s - prevAnchorPos > 1) {
            const gapCount = s - prevAnchorPos - 1
            const startOrder = prevAnchorOrder + 1
            for (const n of nodes) {
              if (n.order >= startOrder && n.order !== -1) {
                n.order += gapCount
              }
            }
            nextOrder += gapCount
            for (let g = 1; g <= gapCount; g++) {
              const gapIdx = absIdx(seq[prevAnchorPos + g]!)
              if (nodes[gapIdx]!.order === -1) {
                nodes[gapIdx]!.order = startOrder + g - 1
              }
            }
          }
          prevAnchorPos = s
          prevAnchorOrder = node.order
        }
      }

      for (const rawIdx of seq) {
        const idx = absIdx(rawIdx)
        if (nodes[idx]!.order === -1) {
          nodes[idx]!.order = nextOrder++
        }
      }
    }
  }

  for (const node of nodes) {
    if (node.order === -1) {
      node.order = nextOrder++
    }
  }
}

// Pass 2: build successor/predecessor adjacency from tracks (using Sets for O(1) lookup)
function generateNodeSuccessors(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  for (const track of tracks) {
    const seq = track.sequence
    for (let i = 0; i < seq.length - 1; i++) {
      const a = absIdx(seq[i]!)
      const b = absIdx(seq[i + 1]!)
      const nodeA = nodes[a]!
      const nodeB = nodes[b]!

      if (nodeA.order <= nodeB.order) {
        nodeA.successors.add(b)
        nodeB.predecessors.add(a)
      } else {
        nodeB.successors.add(a)
        nodeA.predecessors.add(b)
      }
    }
  }

  for (const node of nodes) {
    node.degree = node.successors.size + node.predecessors.size
  }
}

// Pass 3: assign lanes (vertical slots) to track segments at each order position
function generateLaneAssignment(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  const mo = maxOrder(nodes)
  const assignments: NodeAssignment[][] = Array.from(
    { length: mo + 1 },
    () => [],
  )

  // map from (order, nodeIdx) → index in assignments[order] for O(1) lookup
  const slotIndex = new Map<string, number>()

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t]!
    const seq = track.sequence
    const path: PathSegment[] = []
    track.path = path

    for (let s = 0; s < seq.length; s++) {
      const rawIdx = seq[s]!
      const idx = absIdx(rawIdx)
      const isForward = rawIdx >= 0
      const node = nodes[idx]!
      const order = node.order

      const segment: PathSegment = {
        order,
        lane: 0,
        isForward,
        node: idx,
        y: 0,
      }
      path.push(segment)

      addToAssignment(assignments, slotIndex, order, idx, t, path.length - 1)

      if (s < seq.length - 1) {
        const nextRaw = seq[s + 1]!
        const nextIdx = absIdx(nextRaw)
        const nextOrder = nodes[nextIdx]!.order

        if (nextOrder !== order) {
          const step = nextOrder > order ? 1 : -1
          let cur = order + step
          while (cur !== nextOrder) {
            const edgeSegment: PathSegment = {
              order: cur,
              lane: 0,
              isForward,
              node: null,
              y: 0,
            }
            path.push(edgeSegment)
            addToAssignment(
              assignments,
              slotIndex,
              cur,
              null,
              t,
              path.length - 1,
            )
            cur += step
          }
        }
      }
    }
  }

  for (let order = 0; order <= mo; order++) {
    assignLanesAtOrder(assignments[order]!)
  }

  return assignments
}

function addToAssignment(
  assignments: NodeAssignment[][],
  slotIndex: Map<string, number>,
  order: number,
  nodeIdx: number | null,
  trackID: number,
  segmentID: number,
) {
  const slot = assignments[order]!
  const ta = {
    trackID,
    segmentID,
    lane: 0,
    idealLane: trackID,
    idealY: null,
  }

  if (nodeIdx !== null) {
    const key = `${order}:${nodeIdx}`
    const existingIdx = slotIndex.get(key)
    if (existingIdx !== undefined) {
      slot[existingIdx]!.tracks.push(ta)
      return
    }
    slotIndex.set(key, slot.length)
  }

  slot.push({
    node: nodeIdx,
    tracks: [ta],
    idealLane: 0,
  })
}

function assignLanesAtOrder(slot: NodeAssignment[]) {
  for (const assignment of slot) {
    let sumIdeal = 0
    let count = 0
    for (const ta of assignment.tracks) {
      sumIdeal += ta.idealLane
      count++
    }
    assignment.idealLane = count > 0 ? sumIdeal / count : 0
  }

  slot.sort((a, b) => a.idealLane - b.idealLane)

  let lane = 0
  for (const assignment of slot) {
    for (const ta of assignment.tracks) {
      ta.lane = lane
    }
    lane += assignment.tracks.length
  }
}

// Pass 4: convert lane assignments to y coordinates
function applyVerticalPositions(
  nodes: TubeMapNode[],
  tracks: TubeMapTrack[],
  assignments: NodeAssignment[][],
) {
  const startY = 20

  for (const slot of assignments) {
    let y = startY

    for (const assignment of slot) {
      if (assignment.node !== null) {
        const node = nodes[assignment.node]!
        node.y = y
        node.topLane = assignment.tracks[0]?.lane ?? 0
      }

      for (const ta of assignment.tracks) {
        ta.idealY = y
        const track = tracks[ta.trackID]!
        const segment = track.path[ta.segmentID]!
        segment.lane = ta.lane
        segment.y = y
        y += TRACK_WIDTH
      }
      y += NODE_PADDING
    }

    for (const assignment of slot) {
      if (assignment.node !== null) {
        const node = nodes[assignment.node]!
        const lastTrack = assignment.tracks.at(-1)
        node.contentHeight =
          lastTrack?.idealY !== undefined && lastTrack.idealY !== null
            ? lastTrack.idealY - node.y + TRACK_WIDTH
            : TRACK_WIDTH
      }
    }
  }
}

// Pass 5: compute x coordinates for nodes; returns orderToX lookup
function generateNodeXCoords(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  const mo = maxOrder(nodes)
  const extraSpace = calculateExtraSpace(nodes, tracks, mo)

  const sorted = [...nodes].sort((a, b) => a.order - b.order)
  const orderToX = new Float64Array(mo + 1)

  let nextX = 0
  let prevOrder = -1

  for (const node of sorted) {
    if (node.order !== prevOrder) {
      nextX += NODE_GAP * (extraSpace[node.order] ?? 1)
      orderToX[node.order] = nextX
      prevOrder = node.order
    }
    node.x = nextX
    nextX += node.pixelWidth + NODE_GAP
  }

  return orderToX
}

function calculateExtraSpace(
  nodes: TubeMapNode[],
  tracks: TubeMapTrack[],
  mo: number,
) {
  const extra = new Float32Array(mo + 1)
  extra.fill(1)

  for (const track of tracks) {
    const path = track.path
    for (let i = 0; i < path.length - 1; i++) {
      const curr = path[i]!
      const next = path[i + 1]!
      if (curr.order !== next.order) {
        const yDiff = Math.abs(next.y - curr.y)
        const angle = yDiff / 17.5
        const order = Math.min(curr.order, next.order)
        if (angle > extra[order]!) {
          extra[order] = angle
        }
      }
    }
  }

  const orderCount = new Uint16Array(mo + 1)
  for (const node of nodes) {
    orderCount[node.order]!++
  }
  for (let i = 0; i <= mo; i++) {
    if (orderCount[i]! > 1 && extra[i]! < 2) {
      extra[i] = 2
    }
  }

  return extra
}
