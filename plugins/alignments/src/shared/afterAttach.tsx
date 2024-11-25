import { getContainingView } from '@jbrowse/core/util'
import { createAutorun } from '../util'
import { fetchChains } from './fetchChains'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

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
  createAutorun(
    self,
    async () => {
      await fetchChains(self)
    },
    { delay: 1000 },
  )

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

    ctx.clearRect(0, 0, canvas.width, self.height * 2)
    ctx.resetTransform()
    ctx.scale(2, 2)
    cb(self, ctx, canvas.width, self.height)
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
