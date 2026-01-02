import {
  calculateFloatingLabelPosition,
  clampToViewport,
  getViewportLeftEdge,
} from './util'

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

  describe('calculateFloatingLabelPosition', () => {
    it('positions label at feature left when visible', () => {
      const labelX = calculateFloatingLabelPosition(
        0, // featureLeftPx
        100, // featureRightPx
        50, // labelWidth
        0, // offsetPx
        0, // viewportLeft
      )
      expect(labelX).toBe(0)
    })

    it('floats label to viewport edge when feature left is off-screen', () => {
      const labelX = calculateFloatingLabelPosition(
        100, // featureLeftPx
        300, // featureRightPx
        50, // labelWidth
        120, // offsetPx
        120, // viewportLeft
      )
      // Label floats to viewportLeft, offset-adjusted: 120 - 120 = 0
      expect(labelX).toBe(0)
    })

    it('clamps label to feature right edge', () => {
      const labelX = calculateFloatingLabelPosition(
        100, // featureLeftPx
        200, // featureRightPx
        50, // labelWidth
        200, // offsetPx
        200, // viewportLeft
      )
      // maxX = 200 - 200 - 50 = -50
      expect(labelX).toBe(-50)
    })
  })
})
