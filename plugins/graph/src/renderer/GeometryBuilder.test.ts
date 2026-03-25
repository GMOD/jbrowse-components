import {
  brightenColors,
  buildGeometry,
  extractColorSlice,
  recolorNodes,
} from './GeometryBuilder.ts'

const simpleGraph = {
  name: 'test',
  nodes: [
    { id: 'A+', name: 'A', length: 100, depth: 1 },
    { id: 'B+', name: 'B', length: 200, depth: 2 },
  ],
  edges: [{ from: 'A+', to: 'B+', overlap: 0 }],
}

const simplePositions = {
  'A+': [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  'B+': [
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ],
}

test('produces non-empty geometry for simple graph', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  })

  expect(batch.nodes.positions.length).toBeGreaterThan(0)
  expect(batch.nodes.colors.length).toBeGreaterThan(0)
  expect(batch.nodes.indices.length).toBeGreaterThan(0)
  expect(batch.edges.positions.length).toBeGreaterThan(0)
  // positions are x,y pairs; colors are r,g,b,a; normals are x,y pairs; thicknesses are 1 per vertex
  expect(batch.nodes.positions.length / 2).toBe(batch.nodes.colors.length / 4)
  expect(batch.nodes.positions.length / 2).toBe(batch.nodes.thicknesses.length)
  expect(batch.nodes.positions.length / 2).toBe(batch.nodes.normals.length / 2)
})

test('produces different geometry for different color schemes', () => {
  const opts = {
    nodePositions: simplePositions,
    graph: simpleGraph,
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  }

  const uniformBatch = buildGeometry({
    ...opts,
    colorScheme: 'uniform' as const,
  })
  const depthBatch = buildGeometry({ ...opts, colorScheme: 'depth' as const })

  expect(uniformBatch.nodes.positions.length).toBe(
    depthBatch.nodes.positions.length,
  )
  let colorsDiffer = false
  for (let i = 0; i < uniformBatch.nodes.colors.length; i++) {
    if (
      Math.abs(uniformBatch.nodes.colors[i]! - depthBatch.nodes.colors[i]!) >
      0.01
    ) {
      colorsDiffer = true
      break
    }
  }
  expect(colorsDiffer).toBe(true)
})

test('tracks vertex ranges for nodes and edges', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  })

  expect(batch.nodeVertexRanges.size).toBe(2)
  expect(batch.nodeVertexRanges.has('A+')).toBe(true)
  expect(batch.nodeVertexRanges.has('B+')).toBe(true)
  expect(batch.edgeVertexRanges.size).toBe(1)
  expect(batch.edgeVertexRanges.has(0)).toBe(true)

  const rangeA = batch.nodeVertexRanges.get('A+')!
  expect(rangeA.start).toBeDefined()
  expect(rangeA.count).toBeGreaterThan(0)
})

test('handles empty node positions gracefully', () => {
  const batch = buildGeometry({
    nodePositions: {},
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  })

  expect(batch.nodes.positions.length).toBe(0)
  expect(batch.nodes.indices.length).toBe(0)
  expect(batch.edges.positions.length).toBe(0)
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
  })

  expect(batch.nodes.positions.length).toBeGreaterThan(0)
  expect(batch.edges.positions.length).toBeGreaterThan(0)
})

test('stores normals and thicknesses for shader-based expansion', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 10,
    connectorThickness: 4,
    drawPaths: false,
  })

  // Normals should have values (not all zeros)
  let hasNonZeroNormal = false
  for (let i = 0; i < batch.nodes.normals.length; i++) {
    if (Math.abs(batch.nodes.normals[i]!) > 0.001) {
      hasNonZeroNormal = true
      break
    }
  }
  expect(hasNonZeroNormal).toBe(true)

  // Thicknesses should be positive for non-center vertices
  let hasPositiveThickness = false
  for (let i = 0; i < batch.nodes.thicknesses.length; i++) {
    if (batch.nodes.thicknesses[i]! > 0) {
      hasPositiveThickness = true
      break
    }
  }
  expect(hasPositiveThickness).toBe(true)
})

test('recolorNodes produces different colors for different schemes', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  })

  const recolored = recolorNodes(
    simpleGraph,
    batch.nodeVertexRanges,
    'depth',
    batch.nodes.colors,
  )

  let colorsDiffer = false
  for (let i = 0; i < recolored.length; i++) {
    if (Math.abs(recolored[i]! - batch.nodes.colors[i]!) > 0.01) {
      colorsDiffer = true
      break
    }
  }
  expect(colorsDiffer).toBe(true)
})

test('brightenColors produces brighter values', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
  })

  const range = batch.nodeVertexRanges.get('A+')!
  const brightened = brightenColors(batch.nodes.colors, range, 1.4)
  const original = extractColorSlice(batch.nodes.colors, range)

  let hasBrighterValue = false
  for (let i = 0; i < brightened.length; i += 4) {
    if (brightened[i]! > original[i]! + 0.01) {
      hasBrighterValue = true
      break
    }
  }
  expect(hasBrighterValue).toBe(true)
})

test('viewport culling skips off-screen nodes', () => {
  const batch = buildGeometry({
    nodePositions: simplePositions,
    graph: simpleGraph,
    colorScheme: 'uniform',
    contigThickness: 5,
    connectorThickness: 1.5,
    drawPaths: false,
    viewportBounds: { minX: -5, minY: -5, maxX: 15, maxY: 5 },
  })

  // Only A+ (x: 0-10) should be in bounds, B+ (x: 20-30) should be culled
  expect(batch.nodeVertexRanges.has('A+')).toBe(true)
  expect(batch.nodeVertexRanges.has('B+')).toBe(false)
})
