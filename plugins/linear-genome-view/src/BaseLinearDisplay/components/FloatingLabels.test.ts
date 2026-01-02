import { calculateFloatingLabelPosition, clampToViewport, getViewportLeftEdge } from './util'

import type { StrandArrowVisualSide } from '../types'

/**
 * Helper to calculate visual left padding from strand arrow info.
 * This mirrors the logic in FloatingLabels.tsx.
 */
function getVisualLeftPadding(
  strandArrowWidth: number,
  strandArrowVisualSide: StrandArrowVisualSide,
): number {
  return strandArrowVisualSide === 'left' ? strandArrowWidth : 0
}

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

  describe('strand arrow visual padding', () => {
    const STRAND_ARROW_WIDTH = 8

    describe('getVisualLeftPadding helper', () => {
      it('returns arrow width when arrow is on visual left', () => {
        expect(getVisualLeftPadding(STRAND_ARROW_WIDTH, 'left')).toBe(8)
      })

      it('returns 0 when arrow is on visual right', () => {
        expect(getVisualLeftPadding(STRAND_ARROW_WIDTH, 'right')).toBe(0)
      })

      it('returns 0 when there is no arrow', () => {
        expect(getVisualLeftPadding(0, null)).toBe(0)
      })
    })

    describe('floating label position with strand arrows', () => {
      it('positions label correctly when arrow is on visual left', () => {
        // Feature layout: [arrow 8px][feature content 100px]
        // Total layout width = 108px, feature at leftPx = 0
        const leftPx = 0
        const strandArrowWidth = STRAND_ARROW_WIDTH
        const strandArrowVisualSide: StrandArrowVisualSide = 'left'
        const featureWidth = 100
        const labelWidth = 50
        const offsetPx = 0
        const viewportLeft = 0

        // Feature content starts after the arrow
        const visualLeftPadding = getVisualLeftPadding(strandArrowWidth, strandArrowVisualSide)
        const featureLeftPx = leftPx + visualLeftPadding
        const featureRightPx = featureLeftPx + featureWidth

        expect(visualLeftPadding).toBe(8)
        expect(featureLeftPx).toBe(8)
        expect(featureRightPx).toBe(108)

        // Label should float starting at feature content left edge (8px)
        const labelX = calculateFloatingLabelPosition(
          featureLeftPx,
          featureRightPx,
          labelWidth,
          offsetPx,
          viewportLeft,
        )
        expect(labelX).toBe(8)
      })

      it('positions label correctly when arrow is on visual right', () => {
        // Feature layout: [feature content 100px][arrow 8px]
        // Total layout width = 108px, feature at leftPx = 0
        const leftPx = 0
        const strandArrowWidth = STRAND_ARROW_WIDTH
        const strandArrowVisualSide: StrandArrowVisualSide = 'right'
        const featureWidth = 100
        const labelWidth = 50
        const offsetPx = 0
        const viewportLeft = 0

        // Feature content starts at left edge (no left padding)
        const visualLeftPadding = getVisualLeftPadding(strandArrowWidth, strandArrowVisualSide)
        const featureLeftPx = leftPx + visualLeftPadding
        const featureRightPx = featureLeftPx + featureWidth

        expect(visualLeftPadding).toBe(0)
        expect(featureLeftPx).toBe(0)
        expect(featureRightPx).toBe(100)

        // Label should float starting at feature content left edge (0px)
        const labelX = calculateFloatingLabelPosition(
          featureLeftPx,
          featureRightPx,
          labelWidth,
          offsetPx,
          viewportLeft,
        )
        expect(labelX).toBe(0)
      })

      it('label floats correctly when scrolling with arrow on visual left', () => {
        // Feature at leftPx = 100, with arrow on left
        // When we scroll right (offsetPx = 120), the feature's left edge
        // goes off-screen, but label should float to stay visible
        const leftPx = 100
        const strandArrowWidth = STRAND_ARROW_WIDTH
        const strandArrowVisualSide: StrandArrowVisualSide = 'left'
        const featureWidth = 200
        const labelWidth = 50
        const offsetPx = 120
        const viewportLeft = 120

        const visualLeftPadding = getVisualLeftPadding(strandArrowWidth, strandArrowVisualSide)
        const featureLeftPx = leftPx + visualLeftPadding // 108
        const featureRightPx = featureLeftPx + featureWidth // 308

        // Feature content left (108) is off-screen (viewport starts at 120)
        // Label should float to viewport left edge
        const labelX = calculateFloatingLabelPosition(
          featureLeftPx,
          featureRightPx,
          labelWidth,
          offsetPx,
          viewportLeft,
        )
        // Label floats to viewportLeft (120), then offset-adjusted: 120 - 120 = 0
        expect(labelX).toBe(0)
      })

      it('label stays within feature bounds when scrolling', () => {
        // Feature with arrow on left, scrolling causes label to hit right bound
        const leftPx = 100
        const strandArrowWidth = STRAND_ARROW_WIDTH
        const strandArrowVisualSide: StrandArrowVisualSide = 'left'
        const featureWidth = 100
        const labelWidth = 50
        const offsetPx = 200
        const viewportLeft = 200

        const visualLeftPadding = getVisualLeftPadding(strandArrowWidth, strandArrowVisualSide)
        const featureLeftPx = leftPx + visualLeftPadding // 108
        const featureRightPx = featureLeftPx + featureWidth // 208

        // Viewport is at 200, but feature right is 208
        // Label (50px wide) should be clamped to not exceed feature right
        // maxX = 208 - 200 - 50 = -42, but natural position would be 0
        // Result is clamped between 0 and maxX
        const labelX = calculateFloatingLabelPosition(
          featureLeftPx,
          featureRightPx,
          labelWidth,
          offsetPx,
          viewportLeft,
        )
        // maxX = featureRightPx - offsetPx - labelWidth = 208 - 200 - 50 = -42
        // naturalX = max(108, 200) - 200 = 0
        // clamp(0, 0, -42) = -42 (when maxX < 0, label is constrained)
        expect(labelX).toBe(-42)
      })
    })
  })
})
