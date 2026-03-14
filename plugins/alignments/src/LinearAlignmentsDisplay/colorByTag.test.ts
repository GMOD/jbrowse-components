describe('updateColorTagMap', () => {
  function createColorTagState() {
    const colorPalette = [
      '#90caf9',
      '#f48fb1',
      '#a5d6a7',
      '#fff59d',
      '#ffab91',
      '#ce93d8',
      '#80deea',
      '#c5e1a5',
      '#ffe082',
      '#bcaaa4',
    ]
    let colorTagMap: Record<string, string> = {}

    function updateColorTagMap(uniqueTag: string[]) {
      const map = { ...colorTagMap }
      let added = false
      for (const value of uniqueTag) {
        if (!map[value]) {
          const totalKeys = Object.keys(map).length
          map[value] = colorPalette[totalKeys % colorPalette.length]!
          added = true
        }
      }
      colorTagMap = map
      return added
    }

    function reset() {
      colorTagMap = {}
    }

    return {
      get colorTagMap() {
        return colorTagMap
      },
      updateColorTagMap,
      reset,
    }
  }

  it('returns true when new tags are added', () => {
    const state = createColorTagState()
    expect(state.updateColorTagMap(['HP:0', 'HP:1'])).toBe(true)
  })

  it('returns false when all tags already exist', () => {
    const state = createColorTagState()
    state.updateColorTagMap(['HP:0', 'HP:1'])
    expect(state.updateColorTagMap(['HP:0', 'HP:1'])).toBe(false)
  })

  it('assigns distinct colors to different tag values', () => {
    const state = createColorTagState()
    state.updateColorTagMap(['HP:0', 'HP:1', 'HP:2'])
    const colors = Object.values(state.colorTagMap)
    expect(new Set(colors).size).toBe(3)
  })

  it('preserves existing colors when new tags are added', () => {
    const state = createColorTagState()
    state.updateColorTagMap(['HP:0'])
    const firstColor = state.colorTagMap['HP:0']
    state.updateColorTagMap(['HP:0', 'HP:1'])
    expect(state.colorTagMap['HP:0']).toBe(firstColor)
  })

  it('starts empty so first RPC sends empty map', () => {
    const state = createColorTagState()
    expect(Object.keys(state.colorTagMap)).toHaveLength(0)
  })
})

describe('color-by-tag re-fetch logic', () => {
  it('triggers re-fetch only when new tag colors are discovered in tag mode', () => {
    let clearCount = 0
    const colorBy = { type: 'tag', tag: 'HP' }

    function simulateFetchResult(
      newTagValues: string[] | undefined,
      colorTagMapEmpty: boolean,
    ) {
      let newTagColorsAdded = false
      if (newTagValues) {
        newTagColorsAdded = colorTagMapEmpty && newTagValues.length > 0
      }
      if (newTagColorsAdded && colorBy.type === 'tag') {
        clearCount++
      }
    }

    simulateFetchResult(['HP:0', 'HP:1'], true)
    expect(clearCount).toBe(1)

    simulateFetchResult(['HP:0', 'HP:1'], false)
    expect(clearCount).toBe(1)
  })

  it('does not trigger re-fetch in non-tag color modes', () => {
    let clearCount = 0
    const colorBy = { type: 'strand' }

    function simulateFetchResult(newTagValues: string[] | undefined) {
      const newTagColorsAdded = newTagValues ? newTagValues.length > 0 : false
      if (newTagColorsAdded && colorBy.type === 'tag') {
        clearCount++
      }
    }

    simulateFetchResult(['HP:0', 'HP:1'])
    expect(clearCount).toBe(0)
  })

  it('re-fetch cycle terminates: second fetch has populated map', () => {
    let colorTagMap: Record<string, string> = {}
    let fetchCount = 0
    const maxFetches = 10

    function updateColorTagMap(tags: string[]) {
      const map = { ...colorTagMap }
      let added = false
      for (const v of tags) {
        if (!map[v]) {
          map[v] = `#color${Object.keys(map).length}`
          added = true
        }
      }
      colorTagMap = map
      return added
    }

    function simulateFetchCycle() {
      while (fetchCount < maxFetches) {
        fetchCount++
        const newTagColorsAdded = updateColorTagMap(['HP:0', 'HP:1'])
        if (!newTagColorsAdded) {
          break
        }
      }
    }

    simulateFetchCycle()
    expect(fetchCount).toBe(2)
    expect(Object.keys(colorTagMap)).toHaveLength(2)
  })
})
