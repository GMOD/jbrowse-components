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
  TrackAssignment,
  TubeMapLayout,
  TubeMapNode,
  TubeMapTrack,
} from './types.ts'

const NODE_GAP = 10
const TRACK_WIDTH = 7
const NODE_PADDING = 25

interface InputNode {
  name: string
  sequenceLength: number
  sequence?: string
}

interface InputTrack {
  id: string
  name: string
  // node names; prepend '>' or '<' for orientation
  segments: { name: string; isForward: boolean }[]
  type: 'haplotype' | 'read'
  indexOfFirstBase: number
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
      pixelWidth: Math.max(n.sequenceLength * widthPerBp, 1),
      contentHeight: 0,
      successors: [],
      predecessors: [],
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
    return { nodes, tracks, maxX: 0, maxY: 0 }
  }

  generateNodeOrder(nodes, tracks)
  generateNodeSuccessors(nodes, tracks)
  const assignments = generateLaneAssignment(nodes, tracks)
  applyVerticalPositions(nodes, tracks, assignments)
  generateNodeXCoords(nodes, tracks)

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

  return { nodes, tracks, maxX, maxY }
}

// Pass 1: assign horizontal order to nodes based on track traversal
function generateNodeOrder(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  let nextOrder = 0

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t]!
    const seq = track.sequence

    if (t === 0) {
      // first track sets the base ordering
      for (const rawIdx of seq) {
        const idx = rawIdx < 0 ? -(rawIdx + 1) : rawIdx
        if (nodes[idx]!.order === -1) {
          nodes[idx]!.order = nextOrder++
        }
      }
    } else {
      // subsequent tracks: find anchors (already-ordered nodes) and fill gaps
      let prevAnchorPos = -1
      let prevAnchorOrder = -1

      for (let s = 0; s < seq.length; s++) {
        const idx = seq[s]! < 0 ? -(seq[s]! + 1) : seq[s]!
        const node = nodes[idx]!

        if (node.order !== -1) {
          // this is an anchor
          if (prevAnchorPos !== -1 && s - prevAnchorPos > 1) {
            // fill unordered nodes between anchors
            const gapCount = s - prevAnchorPos - 1
            const startOrder = prevAnchorOrder + 1
            // shift subsequent nodes to make room
            for (const n of nodes) {
              if (n.order >= startOrder && n.order !== -1) {
                n.order += gapCount
              }
            }
            nextOrder += gapCount
            for (let g = 1; g <= gapCount; g++) {
              const gapIdx =
                seq[prevAnchorPos + g]! < 0
                  ? -(seq[prevAnchorPos + g]! + 1)
                  : seq[prevAnchorPos + g]!
              if (nodes[gapIdx]!.order === -1) {
                nodes[gapIdx]!.order = startOrder + g - 1
              }
            }
          }
          prevAnchorPos = s
          prevAnchorOrder = node.order
        }
      }

      // handle trailing unordered nodes
      for (const rawIdx of seq) {
        const idx = rawIdx < 0 ? -(rawIdx + 1) : rawIdx
        if (nodes[idx]!.order === -1) {
          nodes[idx]!.order = nextOrder++
        }
      }
    }
  }

  // any nodes not in any track get appended
  for (const node of nodes) {
    if (node.order === -1) {
      node.order = nextOrder++
    }
  }
}

// Pass 2: build successor/predecessor adjacency from tracks
function generateNodeSuccessors(
  nodes: TubeMapNode[],
  tracks: TubeMapTrack[],
) {
  for (const track of tracks) {
    const seq = track.sequence
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i]! < 0 ? -(seq[i]! + 1) : seq[i]!
      const b = seq[i + 1]! < 0 ? -(seq[i + 1]! + 1) : seq[i + 1]!
      const nodeA = nodes[a]!
      const nodeB = nodes[b]!

      if (nodeA.order <= nodeB.order) {
        if (!nodeA.successors.includes(b)) {
          nodeA.successors.push(b)
        }
        if (!nodeB.predecessors.includes(a)) {
          nodeB.predecessors.push(a)
        }
      } else {
        if (!nodeB.successors.includes(a)) {
          nodeB.successors.push(a)
        }
        if (!nodeA.predecessors.includes(b)) {
          nodeA.predecessors.push(b)
        }
      }
    }
  }

  for (const node of nodes) {
    node.degree = node.successors.length + node.predecessors.length
  }
}

// Pass 3: assign lanes (vertical slots) to track segments at each order position
function generateLaneAssignment(
  nodes: TubeMapNode[],
  tracks: TubeMapTrack[],
) {
  const maxOrder = Math.max(...nodes.map(n => n.order), 0)
  const assignments: NodeAssignment[][] = Array.from(
    { length: maxOrder + 1 },
    () => [],
  )

  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t]!
    const seq = track.sequence
    const path: PathSegment[] = []
    track.path = path

    for (let s = 0; s < seq.length; s++) {
      const rawIdx = seq[s]!
      const idx = rawIdx < 0 ? -(rawIdx + 1) : rawIdx
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

      addToAssignment(assignments, order, idx, t, path.length - 1)

      // add edge segments between consecutive nodes at different orders
      if (s < seq.length - 1) {
        const nextRaw = seq[s + 1]!
        const nextIdx = nextRaw < 0 ? -(nextRaw + 1) : nextRaw
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
            addToAssignment(assignments, cur, null, t, path.length - 1)
            cur += step
          }
        }
      }
    }
  }

  // now assign actual lane numbers within each order slot
  for (let order = 0; order <= maxOrder; order++) {
    assignLanesAtOrder(assignments[order]!, order, nodes, tracks)
  }

  return assignments
}

function addToAssignment(
  assignments: NodeAssignment[][],
  order: number,
  nodeIdx: number | null,
  trackID: number,
  segmentID: number,
) {
  const slot = assignments[order]!

  // find existing assignment for this node
  let existing: NodeAssignment | undefined
  if (nodeIdx !== null) {
    existing = slot.find(a => a.node === nodeIdx)
  }

  if (existing) {
    existing.tracks.push({
      trackID,
      segmentID,
      lane: 0,
      idealLane: trackID,
      idealY: null,
    })
  } else {
    slot.push({
      node: nodeIdx,
      tracks: [
        {
          trackID,
          segmentID,
          lane: 0,
          idealLane: trackID,
          idealY: null,
        },
      ],
      idealLane: 0,
    })
  }
}

function assignLanesAtOrder(
  slot: NodeAssignment[],
  _order: number,
  _nodes: TubeMapNode[],
  _tracks: TubeMapTrack[],
) {
  // compute ideal lanes based on predecessor positions
  for (const assignment of slot) {
    let sumIdeal = 0
    let count = 0
    for (const ta of assignment.tracks) {
      sumIdeal += ta.idealLane
      count++
    }
    assignment.idealLane = count > 0 ? sumIdeal / count : 0
  }

  // sort by ideal lane
  slot.sort((a, b) => a.idealLane - b.idealLane)

  // assign sequential lanes
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

  for (let order = 0; order < assignments.length; order++) {
    const slot = assignments[order]!
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

    // set content height on nodes at this order
    for (const assignment of slot) {
      if (assignment.node !== null) {
        const node = nodes[assignment.node]!
        const lastTrack = assignment.tracks.at(-1)
        if (lastTrack?.idealY !== undefined && lastTrack.idealY !== null) {
          node.contentHeight = lastTrack.idealY - node.y + TRACK_WIDTH
        } else {
          node.contentHeight = TRACK_WIDTH
        }
      }
    }
  }
}

// Pass 5: compute x coordinates for nodes
function generateNodeXCoords(nodes: TubeMapNode[], tracks: TubeMapTrack[]) {
  const maxOrder = Math.max(...nodes.map(n => n.order), 0)
  const extraSpace = calculateExtraSpace(nodes, tracks, maxOrder)

  // sort nodes by order
  const sorted = [...nodes].sort((a, b) => a.order - b.order)

  let nextX = 0
  let prevOrder = -1

  for (const node of sorted) {
    if (node.order !== prevOrder) {
      nextX += NODE_GAP * (extraSpace[node.order] ?? 1)
      prevOrder = node.order
    }
    node.x = nextX
    nextX += node.pixelWidth + NODE_GAP
  }
}

function calculateExtraSpace(
  nodes: TubeMapNode[],
  tracks: TubeMapTrack[],
  maxOrder: number,
) {
  const extra = new Float32Array(maxOrder + 1)
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

  // also add space for nodes at the same order (stacked)
  const orderCount = new Uint16Array(maxOrder + 1)
  for (const node of nodes) {
    orderCount[node.order]!++
  }
  for (let i = 0; i <= maxOrder; i++) {
    if (orderCount[i]! > 1 && extra[i]! < 2) {
      extra[i] = 2
    }
  }

  return extra
}
