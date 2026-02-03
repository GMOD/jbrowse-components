import { calculateFloatingLabelPosition } from './util.ts'

describe('FloatingLabels utilities', () => {
  describe('calculateFloatingLabelPosition', () => {
    it('positions label at feature left when visible', () => {
      const labelX = calculateFloatingLabelPosition(
        0, // featureLeftPx
        100, // featureRightPx
        50, // labelWidth
        0, // offsetPx
      )
      expect(labelX).toBe(0)
    })

    it('floats label to viewport edge when feature left is off-screen', () => {
      const labelX = calculateFloatingLabelPosition(
        100, // featureLeftPx
        300, // featureRightPx
        50, // labelWidth
        120, // offsetPx
      )
      // Label floats to viewportLeft (120), offset-adjusted: 120 - 120 = 0
      expect(labelX).toBe(0)
    })

    it('clamps label to feature right edge', () => {
      const labelX = calculateFloatingLabelPosition(
        100, // featureLeftPx
        200, // featureRightPx
        50, // labelWidth
        200, // offsetPx
      )
      // maxX = 200 - 200 - 50 = -50
      expect(labelX).toBe(-50)
    })
  })
})
