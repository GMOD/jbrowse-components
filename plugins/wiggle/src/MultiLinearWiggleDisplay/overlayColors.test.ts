import { set1 as overlayColors } from '@jbrowse/core/ui/colors'

function resolveOverlayColor(
  index: number,
  isOverlay: boolean,
  adapterColor?: string,
  layoutColor?: string,
) {
  if (isOverlay) {
    return (
      layoutColor ?? adapterColor ?? overlayColors[index % overlayColors.length]
    )
  }
  return layoutColor ?? adapterColor
}

interface Source {
  name: string
  color?: string
}

function buildSources(
  sourcesVolatile: Source[],
  layout: Source[],
  subtreeFilter: string[] | undefined,
  isOverlay: boolean,
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
      isOverlay,
      sourceMap[s.name]?.color,
      layoutColors[s.name],
    ),
  }))
}

describe('multi-wiggle overlay color assignment', () => {
  const sources: Source[] = Array.from({ length: 12 }, (_, i) => ({
    name: `source_${i}`,
  }))

  it('assigns distinct palette colors in overlay mode', () => {
    const result = buildSources(sources, [], undefined, true)
    const colors = result.map(s => s.color)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(
      Math.min(sources.length, overlayColors.length),
    )
  })

  it('assigns no automatic colors in multi-row mode', () => {
    const result = buildSources(sources, [], undefined, false)
    for (const s of result) {
      expect(s.color).toBeUndefined()
    }
  })

  it('re-indexes colors after filtering in overlay mode', () => {
    const filter = ['source_0', 'source_5']
    const result = buildSources(sources, [], filter, true)
    expect(result[0]!.color).toBe(overlayColors[0])
    expect(result[1]!.color).toBe(overlayColors[1])
  })

  it('preserves explicit adapter colors in overlay mode', () => {
    const withColors: Source[] = [
      { name: 'a', color: '#ff0000' },
      { name: 'b' },
      { name: 'c', color: '#00ff00' },
    ]
    const result = buildSources(withColors, [], undefined, true)
    expect(result[0]!.color).toBe('#ff0000')
    expect(result[1]!.color).toBe(overlayColors[1])
    expect(result[2]!.color).toBe('#00ff00')
  })

  it('preserves explicit adapter colors in multi-row mode', () => {
    const withColors: Source[] = [
      { name: 'a', color: '#ff0000' },
      { name: 'b' },
      { name: 'c', color: '#00ff00' },
    ]
    const result = buildSources(withColors, [], undefined, false)
    expect(result[0]!.color).toBe('#ff0000')
    expect(result[1]!.color).toBeUndefined()
    expect(result[2]!.color).toBe('#00ff00')
  })

  it('preserves explicit layout colors over adapter colors', () => {
    const vol: Source[] = [{ name: 'a', color: '#ff0000' }, { name: 'b' }]
    const layout: Source[] = [{ name: 'a', color: '#0000ff' }, { name: 'b' }]
    const result = buildSources(vol, layout, undefined, true)
    expect(result[0]!.color).toBe('#0000ff')
  })

  it('preserves layout colors in multi-row mode', () => {
    const vol: Source[] = [{ name: 'a' }, { name: 'b' }]
    const layout: Source[] = [{ name: 'a', color: '#0000ff' }, { name: 'b' }]
    const result = buildSources(vol, layout, undefined, false)
    expect(result[0]!.color).toBe('#0000ff')
    expect(result[1]!.color).toBeUndefined()
  })
})
