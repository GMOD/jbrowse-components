import { when } from 'mobx'

import { makeSidebarSvg } from '../shared/makeSidebarSvg.tsx'

import type { LegendBarModel } from '../shared/components/types.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

interface Model extends LegendBarModel {
  regionCannotBeRenderedText?: any
  hierarchy: any
  availableHeight: number
  totalHeight: number
  treeAreaWidth: number
}

export async function renderSvg(
  self: Model,
  opts: ExportSvgDisplayOptions,
  superRenderSvg: (opts: ExportSvgDisplayOptions) => Promise<React.ReactNode>,
) {
  await when(() => !!self.regionCannotBeRenderedText)
  const dataSvg = await superRenderSvg(opts)
  const legendSvg = await makeSidebarSvg(self)

  return (
    <>
      <g id="data-layer">{dataSvg}</g>
      {legendSvg}
    </>
  )
}
