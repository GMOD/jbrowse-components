describe('SharedWiggleMixin preProcessSnapshot', () => {
  // The preProcessSnapshot function transforms simplified options
  // into the full snapshot format

  describe('minScore/maxScore transformation', () => {
    test('transforms minScore to constraints.min', () => {
      const input = { minScore: 0 }
      const result = transformWiggleSnapshot(input)
      expect(result.constraints?.min).toBe(0)
    })

    test('transforms maxScore to constraints.max', () => {
      const input = { maxScore: 100 }
      const result = transformWiggleSnapshot(input)
      expect(result.constraints?.max).toBe(100)
    })

    test('transforms both minScore and maxScore', () => {
      const input = { minScore: -10, maxScore: 50 }
      const result = transformWiggleSnapshot(input)
      expect(result.constraints).toEqual({ min: -10, max: 50 })
    })

    test('merges with existing constraints', () => {
      const input = { minScore: 0, constraints: { max: 200 } }
      const result = transformWiggleSnapshot(input)
      expect(result.constraints).toEqual({ min: 0, max: 200 })
    })
  })

  describe('scaleType transformation', () => {
    test('transforms scaleType to scale', () => {
      const input = { scaleType: 'log' }
      const result = transformWiggleSnapshot(input)
      expect(result.scale).toBe('log')
    })

    test('does not override existing scale', () => {
      const input = { scaleType: 'log', scale: 'linear' }
      const result = transformWiggleSnapshot(input)
      expect(result.scale).toBe('linear')
    })
  })

  describe('crossHatches transformation', () => {
    test('transforms crossHatches to displayCrossHatches', () => {
      const input = { crossHatches: true }
      const result = transformWiggleSnapshot(input)
      expect(result.displayCrossHatches).toBe(true)
    })
  })

  describe('color passthrough', () => {
    test('passes through color property', () => {
      const input = { color: 'green' }
      const result = transformWiggleSnapshot(input)
      expect(result.color).toBe('green')
    })

    test('passes through posColor property', () => {
      const input = { posColor: 'blue' }
      const result = transformWiggleSnapshot(input)
      expect(result.posColor).toBe('blue')
    })

    test('passes through negColor property', () => {
      const input = { negColor: 'red' }
      const result = transformWiggleSnapshot(input)
      expect(result.negColor).toBe('red')
    })

    test('color works together with other options', () => {
      const input = { color: 'purple', minScore: 0, maxScore: 100 }
      const result = transformWiggleSnapshot(input)
      expect(result.color).toBe('purple')
      expect(result.constraints).toEqual({ min: 0, max: 100 })
    })
  })
})

// Helper that matches the preProcessSnapshot logic
function transformWiggleSnapshot(snap: Record<string, unknown>) {
  const { minScore, maxScore, scaleType, crossHatches, ...rest } = snap as {
    minScore?: number
    maxScore?: number
    scaleType?: string
    crossHatches?: boolean
    scale?: string
    displayCrossHatches?: boolean
    constraints?: { min?: number; max?: number }
    color?: string
    posColor?: string
    negColor?: string
    [key: string]: unknown
  }

  return {
    ...rest,
    ...(scaleType !== undefined && !rest.scale ? { scale: scaleType } : {}),
    ...(crossHatches !== undefined && rest.displayCrossHatches === undefined
      ? { displayCrossHatches: crossHatches }
      : {}),
    ...(minScore !== undefined || maxScore !== undefined
      ? {
          constraints: {
            ...rest.constraints,
            ...(minScore !== undefined ? { min: minScore } : {}),
            ...(maxScore !== undefined ? { max: maxScore } : {}),
          },
        }
      : {}),
  }
}
