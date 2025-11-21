import { drawTree } from './drawTree'

import type { TreeSidebarModel } from './types'

export default async function TreeSvg({ model }: { model: TreeSidebarModel }) {
  const { hierarchy, treeAreaWidth, totalHeight } = model as any

  if (!hierarchy) {
    return null
  }

  const C2S = await import('canvas2svg')
  const ctx = new C2S.default(treeAreaWidth, totalHeight)

  drawTree(ctx, hierarchy, treeAreaWidth, totalHeight)

  return <g dangerouslySetInnerHTML={{ __html: ctx.getSvg().innerHTML }} />
}
