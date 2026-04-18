import {
  brightenColors,
  buildGeometry,
  extractColorSlice,
} from './GeometryBuilder.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_F32,
} from './shaders/graph.generated.ts'

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

  expect(batch.nodes.vertexCount).toBeGreaterThan(0)
  expect(batch.nodes.colors.length).toBeGreaterThan(0)
  expect(batch.nodes.indices.length).toBeGreaterThan(0)
  expect(batch.edges.vertexCount).toBeGreaterThan(0)
  expect(batch.nodes.vertexCount).toBe(batch.nodes.colors.length)
  expect(batch.nodes.vertexData.length).toBe(
    batch.nodes.vertexCount * INSTANCE_STRIDE_F32,
  )
  expect(batch.nodes.vertexDataU32.buffer).toBe(batch.nodes.vertexData.buffer)
  const firstVertexColor = batch.nodes.vertexDataU32[FIELD_OFFSET_F32.color]
  expect(firstVertexColor).toBe(batch.nodes.colors[0])
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

  expect(uniformBatch.nodes.vertexCount).toBe(depthBatch.nodes.vertexCount)
  let colorsDiffer = false
  for (let i = 0; i < uniformBatch.nodes.colors.length; i++) {
    if (uniformBatch.nodes.colors[i] !== depthBatch.nodes.colors[i]) {
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

  expect(batch.nodes.vertexCount).toBe(0)
  expect(batch.nodes.indices.length).toBe(0)
  expect(batch.edges.vertexCount).toBe(0)
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

  expect(batch.nodes.vertexCount).toBeGreaterThan(0)
  expect(batch.edges.vertexCount).toBeGreaterThan(0)
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

  const { vertexData, vertexCount } = batch.nodes
  let hasNonZeroNormal = false
  let hasPositiveThickness = false
  for (let i = 0; i < vertexCount; i++) {
    const base = i * INSTANCE_STRIDE_F32
    if (
      Math.abs(vertexData[base + FIELD_OFFSET_F32.normal]!) > 0.001 ||
      Math.abs(vertexData[base + FIELD_OFFSET_F32.normal + 1]!) > 0.001
    ) {
      hasNonZeroNormal = true
    }
    if (vertexData[base + FIELD_OFFSET_F32.thickness]! > 0) {
      hasPositiveThickness = true
    }
  }
  expect(hasNonZeroNormal).toBe(true)
  expect(hasPositiveThickness).toBe(true)
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
  for (let i = 0; i < brightened.length; i++) {
    const origR = original[i]! & 0xff
    const brightR = brightened[i]! & 0xff
    if (brightR > origR) {
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

  expect(batch.nodeVertexRanges.has('A+')).toBe(true)
  expect(batch.nodeVertexRanges.has('B+')).toBe(false)
})
