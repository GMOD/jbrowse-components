import { getContainingView } from '@jbrowse/core/util'

import { createAutorun } from '../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type LGV = LinearGenomeViewModel

export function doAfterAttach<T extends IAnyStateTreeNode>(
  self: T,
  cb: (
    self: T,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => void,
) {
  function draw(view: LGV) {
    const canvas = self.ref
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    if (!self.chainData) {
      return
    }

    const height = 'layoutHeight' in self ? self.layoutHeight || 1 : self.height
    ctx.resetTransform()
    // Clear entire canvas to avoid artifacts when content height changes on scroll
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(2, 2)
    cb(self, ctx, canvas.width, height)
    self.setLastDrawnOffsetPx(view.offsetPx)
    self.setLastDrawnBpPerPx(view.bpPerPx)
  }

  // first autorun instantly draws if bpPerPx changes
  createAutorun(self, async () => {
    const view = getContainingView(self) as LGV
    if (view.bpPerPx !== self.lastDrawnBpPerPx) {
      draw(view)
    }
  })

  // second autorun draws after delay 1000 e.g. if offsetPx changes
  createAutorun(
    self,
    async () => {
      const view = getContainingView(self) as LGV
      draw(view)
    },
    { delay: 1000 },
  )
}
