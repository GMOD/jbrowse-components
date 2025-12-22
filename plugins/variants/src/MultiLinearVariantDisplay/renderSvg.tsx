import { when } from 'mobx'

import { makeSidebarSvg } from '../shared/makeSidebarSvg'

import type { MultiLinearVariantDisplayModel } from './model'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: MultiLinearVariantDisplayModel,
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
