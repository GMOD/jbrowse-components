describe('synteny view bounds checking', () => {
  function getViewPair(
    views: { offsetPx: number; bpPerPx: number }[],
    level: number,
  ) {
    if (level + 1 >= views.length) {
      return undefined
    }
    return {
      v0: views[level]!,
      v1: views[level + 1]!,
    }
  }

  function getAssemblyNames(
    views: { assemblyNames: string[] }[],
    level: number,
  ) {
    if (level + 1 >= views.length) {
      return []
    }
    return [views[level]!.assemblyNames[0], views[level + 1]!.assemblyNames[0]]
  }

  it('returns view pair for valid level', () => {
    const views = [
      { offsetPx: 0, bpPerPx: 1 },
      { offsetPx: 100, bpPerPx: 2 },
      { offsetPx: 200, bpPerPx: 1 },
    ]
    const pair = getViewPair(views, 0)
    expect(pair).toBeDefined()
    expect(pair!.v0.offsetPx).toBe(0)
    expect(pair!.v1.offsetPx).toBe(100)
  })

  it('returns undefined when level is out of bounds', () => {
    const views = [{ offsetPx: 0, bpPerPx: 1 }]
    expect(getViewPair(views, 0)).toBeUndefined()
    expect(getViewPair(views, 1)).toBeUndefined()
  })

  it('returns undefined when level+1 equals views length', () => {
    const views = [
      { offsetPx: 0, bpPerPx: 1 },
      { offsetPx: 100, bpPerPx: 2 },
    ]
    expect(getViewPair(views, 1)).toBeUndefined()
  })

  it('returns empty assembly names when level is out of bounds', () => {
    const views = [{ assemblyNames: ['hg38'] }]
    expect(getAssemblyNames(views, 0)).toEqual([])
    expect(getAssemblyNames(views, 5)).toEqual([])
  })

  it('returns assembly names for valid level', () => {
    const views = [
      { assemblyNames: ['hg38'] },
      { assemblyNames: ['mm39'] },
    ]
    expect(getAssemblyNames(views, 0)).toEqual(['hg38', 'mm39'])
  })

  it('handles empty views array', () => {
    expect(getViewPair([], 0)).toBeUndefined()
    expect(getAssemblyNames([], 0)).toEqual([])
  })
})
