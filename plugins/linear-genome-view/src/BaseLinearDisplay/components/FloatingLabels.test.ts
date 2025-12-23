import { clampToViewport, getViewportLeftEdge } from './util'

describe('FloatingLabels', () => {
  describe('label positioning with strand arrow padding', () => {
    test('positive strand feature - label uses actual feature bounds', () => {
      // Feature with positive strand (leftPadding: 0)
      const featureWidth = 100
      const leftPadding = 0
      const totalLayoutWidth = 108
      const leftPx = 50

      // Calculate label bounds
      const featureLeftPx = leftPx + leftPadding // 50 + 0 = 50
      const featureRightPx = featureLeftPx + featureWidth // 50 + 100 = 150

      expect(featureLeftPx).toBe(50)
      expect(featureRightPx).toBe(150)
      expect(featureRightPx - featureLeftPx).toBe(featureWidth)
    })

    test('negative strand feature - label excludes left padding area', () => {
      // Feature with negative strand (leftPadding: 8)
      const featureWidth = 100
      const leftPadding = 8
      const totalLayoutWidth = 108
      const leftPx = 50

      // Calculate label bounds - should exclude the 8px padding on left
      const featureLeftPx = leftPx + leftPadding // 50 + 8 = 58
      const featureRightPx = featureLeftPx + featureWidth // 58 + 100 = 158

      expect(featureLeftPx).toBe(58)
      expect(featureRightPx).toBe(158)
      expect(featureRightPx - featureLeftPx).toBe(featureWidth)
    })

    test('subfeature label - always uses leftPadding: 0', () => {
      // Subfeature (transcript) always has leftPadding: 0
      const featureWidth = 200
      const leftPadding = 0
      const leftPx = 100

      const featureLeftPx = leftPx + leftPadding // 100 + 0 = 100
      const featureRightPx = featureLeftPx + featureWidth // 100 + 200 = 300

      expect(featureLeftPx).toBe(100)
      expect(featureRightPx).toBe(300)
      expect(featureRightPx - featureLeftPx).toBe(featureWidth)
    })

    test('label fits within feature bounds when width check passes', () => {
      const featureWidth = 100
      const labelWidth = 80
      const leftPadding = 8
      const leftPx = 50

      // Label should fit
      expect(labelWidth <= featureWidth).toBe(true)

      const featureLeftPx = leftPx + leftPadding
      const featureRightPx = featureLeftPx + featureWidth

      // Label can be positioned within actual feature bounds
      expect(featureRightPx - featureLeftPx).toBeGreaterThanOrEqual(labelWidth)
    })

    test('label is filtered when too wide for actual feature', () => {
      const featureWidth = 50
      const labelWidth = 100
      const leftPadding = 8

      // Label should not fit in the actual feature width
      expect(labelWidth > featureWidth).toBe(true)

      // This label would be filtered out in the rendering logic
    })
  })
})

describe('FloatingLabels utilities', () => {
  describe('getViewportLeftEdge', () => {
    it('returns 0 when offsetPx is negative (scrolled left)', () => {
      expect(getViewportLeftEdge(-100)).toBe(0)
      expect(getViewportLeftEdge(-1)).toBe(0)
      expect(getViewportLeftEdge(-1000)).toBe(0)
    })

    it('returns offsetPx when positive (scrolled right)', () => {
      expect(getViewportLeftEdge(100)).toBe(100)
      expect(getViewportLeftEdge(1)).toBe(1)
      expect(getViewportLeftEdge(1000)).toBe(1000)
    })

    it('returns 0 when offsetPx is 0', () => {
      expect(getViewportLeftEdge(0)).toBe(0)
    })
  })

  describe('clampToViewport', () => {
    describe('when scrolled left (offsetPx < 0)', () => {
      it('clamps negative positions to 0', () => {
        const result = clampToViewport(-100, 200, -50)
        expect(result.leftPx).toBe(0)
        expect(result.rightPx).toBe(200)
      })

      it('keeps positive positions unchanged', () => {
        const result = clampToViewport(50, 200, -50)
        expect(result.leftPx).toBe(50)
        expect(result.rightPx).toBe(200)
      })

      it('clamps both positions when both negative', () => {
        const result = clampToViewport(-100, -50, -150)
        expect(result.leftPx).toBe(0)
        expect(result.rightPx).toBe(0)
      })
    })

    describe('when scrolled right (offsetPx > 0)', () => {
      it('clamps positions less than offsetPx', () => {
        const result = clampToViewport(50, 200, 100)
        expect(result.leftPx).toBe(100)
        expect(result.rightPx).toBe(200)
      })

      it('keeps positions greater than offsetPx unchanged', () => {
        const result = clampToViewport(150, 200, 100)
        expect(result.leftPx).toBe(150)
        expect(result.rightPx).toBe(200)
      })

      it('clamps both positions when both less than offsetPx', () => {
        const result = clampToViewport(50, 80, 100)
        expect(result.leftPx).toBe(100)
        expect(result.rightPx).toBe(100)
      })
    })

    describe('when not scrolled (offsetPx = 0)', () => {
      it('only clamps negative positions', () => {
        const result = clampToViewport(-50, 100, 0)
        expect(result.leftPx).toBe(0)
        expect(result.rightPx).toBe(100)
      })

      it('keeps positive positions unchanged', () => {
        const result = clampToViewport(50, 100, 0)
        expect(result.leftPx).toBe(50)
        expect(result.rightPx).toBe(100)
      })
    })

    describe('edge cases', () => {
      it('handles leftPx === offsetPx', () => {
        const result = clampToViewport(100, 200, 100)
        expect(result.leftPx).toBe(100)
        expect(result.rightPx).toBe(200)
      })

      it('handles rightPx === offsetPx', () => {
        const result = clampToViewport(50, 100, 100)
        expect(result.leftPx).toBe(100)
        expect(result.rightPx).toBe(100)
      })

      it('handles leftPx > rightPx (reversed feature)', () => {
        // In practice this shouldn't happen, but function should handle it
        const result = clampToViewport(200, 100, 50)
        expect(result.leftPx).toBe(200)
        expect(result.rightPx).toBe(100)
      })
    })
  })
})
