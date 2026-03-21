import { buildGeometry } from './GeometryBuilder.ts'

const simpleGraph = {
  name: 'test',
  nodes: [
    { id: 'A+', name: 'A', length: 100, depth: 1 },
    { id: 'B+', name: 'B', length: 200, depth: 2 },
  ],
  edges: [{ from: 'A+', to: 'B+', overlap: 0 }],
}

const simplePositions = {
  'A+': [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  'B+': [{ x: 20, y: 0 }, { x: 30, y: 0 }],
}

test('produces non-empty geometry for simple graph', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
    hoveredNode: null,
    hoveredEdge: null,
    selectedNode: null,
    scale: 1,
  })

  expect(batch.positions.length).toBeGreaterThan(0)
  expect(batch.colors.length).toBeGreaterThan(0)
  expect(batch.indices.length).toBeGreaterThan(0)
  // positions are x,y pairs, colors are r,g,b,a
  expect(batch.positions.length / 2).toBe(batch.colors.length / 4)
})

test('produces different geometry for different color schemes', () => {
  const opts = {
    nodePositions: simplePositions,
    graph: simpleGraph,
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
    hoveredNode: null,
    hoveredEdge: null,
    selectedNode: null,
    scale: 1,
  }

  const uniformBatch = buildGeometry({ ...opts, colorScheme: 'uniform' as const })
  const depthBatch = buildGeometry({ ...opts, colorScheme: 'depth' as const })

  // Same vertex count but different colors
  expect(uniformBatch.positions.length).toBe(depthBatch.positions.length)
  // colors should differ (depth-based vs uniform)
  let colorsDiffer = false
  for (let i = 0; i < uniformBatch.colors.length; i++) {
    if (Math.abs(uniformBatch.colors[i]! - depthBatch.colors[i]!) > 0.01) {
      colorsDiffer = true
      break
    }
  }
  expect(colorsDiffer).toBe(true)
})

test('hovered node produces thicker geometry', () => {
  const opts = {
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform' as const,
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
    hoveredEdge: null,
    selectedNode: null,
    scale: 1,
  }

  const normalBatch = buildGeometry({ ...opts, hoveredNode: null })
  const hoveredBatch = buildGeometry({ ...opts, hoveredNode: 'A+' })

  // Hovered node is thicker, so it generates different vertex positions
  let positionsDiffer = false
  for (let i = 0; i < normalBatch.positions.length; i++) {
    if (Math.abs(normalBatch.positions[i]! - hoveredBatch.positions[i]!) > 0.001) {
      positionsDiffer = true
      break
    }
  }
  expect(positionsDiffer).toBe(true)
})

test('handles empty node positions gracefully', () => {
  const batch = buildGeometry({
    nodePositions: {},
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
    hoveredNode: null,
    hoveredEdge: null,
    selectedNode: null,
    scale: 1,
  })

  expect(batch.positions.length).toBe(0)
  expect(batch.indices.length).toBe(0)
})

test('handles graph with paths and drawPaths', () => {
  const graphWithPaths = {
    ...simpleGraph,
    edges: [{ from: 'A+', to: 'B+', overlap: 0, pathIds: ['p1'] }],
    paths: [{ name: 'p1', nodeIds: ['A+', 'B+'] }],
  }

  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: graphWithPaths,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: true,
    hoveredNode: null,
    hoveredEdge: null,
    selectedNode: null,
    scale: 1,
  })

  expect(batch.positions.length).toBeGreaterThan(0)
})
