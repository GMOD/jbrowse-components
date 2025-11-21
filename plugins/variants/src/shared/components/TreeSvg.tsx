import { drawTree } from './drawTree'

import type { Instance } from 'mobx-state-tree'
import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'

interface TreeSvgProps {
  model: Instance<ReturnType<typeof MultiVariantBaseModel>>
}

export default async function TreeSvg({ model }: TreeSvgProps) {
  const { hierarchy, treeAreaWidth, totalHeight } = model as any

  if (!hierarchy) {
    return null
  }

  // @ts-expect-error
  const C2S = await import('canvas2svg')
  const ctx = new C2S.default(treeAreaWidth, totalHeight)

  drawTree(ctx, hierarchy, treeAreaWidth, totalHeight)

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSvg().innerHTML }} />
}
