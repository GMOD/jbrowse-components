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

  describe('resizeHeight under auto-fit', () => {
    // Models the interplay between the resizeHeight override and the
    // CanvasAutoHeight autorun: a drag must turn auto-fit off, otherwise the
    // autorun snaps the height back to fitHeight on the next layout change.
    function makeModel() {
      const maxHeight = 1200
      const minDisplayHeight = 4
      return {
        autoHeight: true,
        height: 100,
        maxY: 600,
        get fitHeight() {
          return Math.min(Math.max(this.maxY, 50), maxHeight)
        },
        resizeHeight(distance: number) {
          if (this.autoHeight) {
            this.autoHeight = false
          }
          this.height = Math.max(this.height + distance, minDisplayHeight)
        },
        runAutoHeightAutorun() {
          if (this.autoHeight) {
            this.height = this.fitHeight
          }
        },
      }
    }

    it('a manual drag turns auto-fit off and the height sticks', () => {
      const model = makeModel()
      model.runAutoHeightAutorun()
      expect(model.height).toBe(600)

      model.resizeHeight(50)
      expect(model.autoHeight).toBe(false)
      expect(model.height).toBe(650)

      // a later layout change re-runs the autorun; with auto-fit off the
      // dragged height is no longer overwritten
      model.maxY = 900
      model.runAutoHeightAutorun()
      expect(model.height).toBe(650)
    })
  })
})
