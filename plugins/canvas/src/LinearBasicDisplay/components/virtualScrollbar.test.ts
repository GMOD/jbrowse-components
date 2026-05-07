describe('per-track scroll', () => {
  describe('hasOverflow', () => {
    function hasOverflow(maxY: number, height: number) {
      return maxY > height
    }

    it('no overflow when content fits', () => {
      expect(hasOverflow(100, 200)).toBe(false)
    })

    it('no overflow when equal', () => {
      expect(hasOverflow(200, 200)).toBe(false)
    })

    it('overflow when content exceeds height', () => {
      expect(hasOverflow(400, 200)).toBe(true)
    })
  })

  describe('expandToFit / collapseFromExpand', () => {
    it('saves height before expanding and restores it', () => {
      let height = 200
      let heightBeforeExpand: number | undefined
      const maxY = 600
      const maxHeight = 1200

      function expandToFit() {
        heightBeforeExpand = height
        height = Math.min(maxY, maxHeight)
      }

      function collapseFromExpand() {
        if (heightBeforeExpand !== undefined) {
          height = heightBeforeExpand
          heightBeforeExpand = undefined
        }
      }

      expandToFit()
      expect(height).toBe(600)
      expect(heightBeforeExpand).toBe(200)

      collapseFromExpand()
      expect(height).toBe(200)
      expect(heightBeforeExpand).toBeUndefined()
    })

    it('caps at maxHeight', () => {
      let height = 200
      let heightBeforeExpand: number | undefined
      const maxY = 2000
      const maxHeight = 1200

      function expandToFit() {
        heightBeforeExpand = height
        height = Math.min(maxY, maxHeight)
      }

      expandToFit()
      expect(height).toBe(1200)
      expect(heightBeforeExpand).toBe(200)
    })
  })
})
