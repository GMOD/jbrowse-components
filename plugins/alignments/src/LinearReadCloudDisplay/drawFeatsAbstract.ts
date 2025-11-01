import { drawFeats as drawFeats1 } from './drawFeats'
import { drawFeats as drawFeats2 } from './drawFeatsStack'
import type { LinearReadCloudDisplayModel } from './model'

export function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
) {
  if (self.drawCloud) {
    drawFeats1(self, ctx)
  } else {
    drawFeats2(self, ctx)
  }
}
