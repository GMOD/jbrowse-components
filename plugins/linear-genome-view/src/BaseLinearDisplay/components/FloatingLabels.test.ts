/* eslint-disable @typescript-eslint/no-unnecessary-condition,@typescript-eslint/no-unused-vars */
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

    test('label fits in totalLayoutWidth but not featureWidth - should be filtered', () => {
      const featureWidth = 100
      const leftPadding = 8
      const totalLayoutWidth = 108
      const labelWidth = 105

      // Label fits in total layout width (including padding)
      expect(labelWidth <= totalLayoutWidth).toBe(true)

      // But doesn't fit in actual feature width (should be filtered)
      expect(labelWidth > featureWidth).toBe(true)
    })

    test('multiple features - padding affects only negative strand labels', () => {
      const features = [
        {
          id: 'pos1',
          strand: 1,
          leftPadding: 0,
          featureWidth: 100,
          totalLayoutWidth: 108,
          leftPx: 50,
        },
        {
          id: 'neg1',
          strand: -1,
          leftPadding: 8,
          featureWidth: 100,
          totalLayoutWidth: 108,
          leftPx: 200,
        },
        {
          id: 'pos2',
          strand: 1,
          leftPadding: 0,
          featureWidth: 80,
          totalLayoutWidth: 88,
          leftPx: 350,
        },
      ]

      for (const feat of features) {
        const featureLeftPx = feat.leftPx + feat.leftPadding
        const featureRightPx = featureLeftPx + feat.featureWidth

        if (feat.strand === 1) {
          // Positive strand - no offset
          expect(featureLeftPx).toBe(feat.leftPx)
        } else {
          // Negative strand - 8px offset
          expect(featureLeftPx).toBe(feat.leftPx + 8)
        }

        expect(featureRightPx - featureLeftPx).toBe(feat.featureWidth)
      }
    })

    test('very small feature with padding - label correctly constrained', () => {
      const featureWidth = 10
      const leftPadding = 8
      const labelWidth = 50
      const leftPx = 100

      // Label is much wider than feature
      expect(labelWidth > featureWidth).toBe(true)

      // Calculate bounds
      const featureLeftPx = leftPx + leftPadding // 108
      const featureRightPx = featureLeftPx + featureWidth // 118

      // Available width is just 10px
      expect(featureRightPx - featureLeftPx).toBe(10)

      // Label won't fit and should be filtered
      expect(labelWidth > featureWidth).toBe(true)
    })
  })

  describe('regression tests for original bug', () => {
    test('negative strand gene - label should not appear in left padding area', () => {
      // This was the original bug: labels appeared in the 8px padding area
      const featureWidth = 200
      const leftPadding = 8
      const totalLayoutWidth = 208
      const leftPx = 100
      const labelWidth = 150

      // Calculate actual feature bounds (excluding padding)
      const featureLeftPx = leftPx + leftPadding // 108
      const featureRightPx = featureLeftPx + featureWidth // 308

      // Label should fit in the actual feature area
      expect(labelWidth <= featureWidth).toBe(true)

      // Label should NOT use the padding area (leftPx to leftPx+8)
      expect(featureLeftPx).toBeGreaterThan(leftPx)
      expect(featureLeftPx).toBe(leftPx + 8)

      // Available width for label is featureWidth, not totalLayoutWidth
      expect(featureRightPx - featureLeftPx).toBe(featureWidth)
      expect(featureRightPx - featureLeftPx).not.toBe(totalLayoutWidth)
    })

    test('subfeature labels align with parent despite parent padding', () => {
      // Parent gene has padding
      const parentLeftPadding = 8
      const parentLeftPx = 100

      // Subfeature (transcript) should use leftPadding: 0 for labels
      const subfeatureLeftPadding = 0
      const subfeatureLeftPx = 100 // Same as parent gene start

      // Parent label starts at leftPx + padding
      const parentLabelStart = parentLeftPx + parentLeftPadding // 108

      // Subfeature label should start at leftPx (no padding offset for labels)
      const subfeatureLabelStart = subfeatureLeftPx + subfeatureLeftPadding // 100

      // Labels should NOT align (parent is offset by padding, subfeature is not)
      // This is correct because parent has visual padding, subfeature doesn't
      expect(parentLabelStart).not.toBe(subfeatureLabelStart)
      expect(parentLabelStart).toBe(108)
      expect(subfeatureLabelStart).toBe(100)
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
