import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

function resolveOverlayColor(
  index: number,
  adapterColor?: string,
  layoutColor?: string,
) {
  return (
    layoutColor ?? adapterColor ?? overlayColors[index % overlayColors.length]
  )
}

interface Source {
  name: string
  color?: string
}

function buildSources(
  sourcesVolatile: Source[],
  layout: Source[],
  subtreeFilter: string[] | undefined,
) {
  const sourceMap = Object.fromEntries(sourcesVolatile.map(s => [s.name, s]))
  const layoutColors = Object.fromEntries(
    layout.filter(s => s.color).map(s => [s.name, s.color]),
  )
  let iter = layout.length ? layout : sourcesVolatile

  if (subtreeFilter?.length) {
    const filterSet = new Set(subtreeFilter)
    iter = iter.filter(s => filterSet.has(s.name))
  }

  return iter.map((s, i) => ({
    source: s.name,
    ...sourceMap[s.name],
    ...s,
    color: resolveOverlayColor(
      i,
      sourceMap[s.name]?.color,
      layoutColors[s.name],
    ),
  }))
}

describe('multi-wiggle overlay color assignment', () => {
  const sources: Source[] = Array.from({ length: 12 }, (_, i) => ({
    name: `source_${i}`,
  }))

  it('assigns distinct colors without filter', () => {
    const result = buildSources(sources, [], undefined)
    const colors = result.map(s => s.color)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(
      Math.min(sources.length, overlayColors.length),
    )
  })

  it('assigns distinct colors after subtreeFilter', () => {
    const filter = ['source_0', 'source_5', 'source_9']
    const result = buildSources(sources, [], filter)
    expect(result).toHaveLength(3)
    const colors = result.map(s => s.color)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(3)
  })

  it('re-indexes colors after filtering so filtered sources get indices 0,1,2', () => {
    const filter = ['source_0', 'source_5']
    const result = buildSources(sources, [], filter)
    expect(result[0]!.color).toBe(overlayColors[0])
    expect(result[1]!.color).toBe(overlayColors[1])
  })

  it('preserves explicit adapter colors', () => {
    const withColors: Source[] = [
      { name: 'a', color: '#ff0000' },
      { name: 'b' },
      { name: 'c', color: '#00ff00' },
    ]
    const result = buildSources(withColors, [], undefined)
    expect(result[0]!.color).toBe('#ff0000')
    expect(result[1]!.color).toBe(overlayColors[1])
    expect(result[2]!.color).toBe('#00ff00')
  })

  it('preserves explicit layout colors over adapter colors', () => {
    const vol: Source[] = [{ name: 'a', color: '#ff0000' }, { name: 'b' }]
    const layout: Source[] = [{ name: 'a', color: '#0000ff' }, { name: 'b' }]
    const result = buildSources(vol, layout, undefined)
    expect(result[0]!.color).toBe('#0000ff')
  })

  it('sources without explicit colors get unique colors (regression: all-blue bug)', () => {
    const sourcesFromRpc: Source[] = [
      { name: 'sample1' },
      { name: 'sample2' },
      { name: 'sample3' },
    ]
    const result = buildSources(sourcesFromRpc, [], undefined)
    const colors = result.map(s => s.color)
    expect(colors[0]).toBe(overlayColors[0])
    expect(colors[1]).toBe(overlayColors[1])
    expect(colors[2]).toBe(overlayColors[2])
    expect(new Set(colors).size).toBe(3)
  })

  it('sources populated from RPC with undefined color do not all resolve to the same color', () => {
    const sourcesFromRpc: Source[] = [
      { name: 'a', color: undefined },
      { name: 'b', color: undefined },
      { name: 'c', color: undefined },
      { name: 'd', color: undefined },
    ]
    const result = buildSources(sourcesFromRpc, [], undefined)
    const colors = result.map(s => s.color)
    expect(new Set(colors).size).toBe(4)
  })
})
