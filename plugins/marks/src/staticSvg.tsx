import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { executeGetEncodedLayers } from '@jbrowse/core/rpc/methods/executeEncodedLayers'
import { renderDisplaySvgInFrame } from '@jbrowse/display-kit/renderDisplaySvg'
import { svgSidebarWidth } from '@jbrowse/tree-sidebar'
import { runInAction } from 'mobx'

import { storedRegionData } from './LinearMarkDisplay/markList.ts'
import { binnedFetchRegions } from './LinearMarkDisplay/markRequest.ts'
import { createMarkStaticHost } from './LinearMarkDisplay/markStaticHost.ts'
import { MarkSvgBody } from './LinearMarkDisplay/renderSvg.tsx'
import { executeGetRowSources } from './MarkRowsRPC/MarkGetRowSources.ts'

import type { HiddenCategory } from './LinearMarkDisplay/markColor.ts'
import type { MarkRegionData } from './LinearMarkDisplay/markList.ts'
import type { MarkStaticFrame } from './LinearMarkDisplay/markStaticHost.ts'
import type { MarkSvgBodyModel } from './LinearMarkDisplay/renderSvg.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { BufferedVisibleRegion } from '@jbrowse/display-kit/regionHost'
import type { SvgViewFrame } from '@jbrowse/display-kit/renderDisplaySvg'
import type {
  ExportSvgDisplayOptions,
  ExportTextStyle,
} from '@jbrowse/display-kit/types'

/**
 * The view a static mark export reads: where it draws, which blocks it
 * autoscales and keys over, and what it fetches at which zoom.
 * `staticLgvFrame` builds one from a region list and a width.
 */
export interface StaticMarkFrame extends SvgViewFrame, MarkStaticFrame {
  bufferedVisibleRegions: BufferedVisibleRegion[]
}

export interface StaticMarkSvgArgs {
  adapterConfig: Record<string, unknown>
  /** The display's config as a track's `displays` entry writes it. */
  display?: Record<string, unknown>
  /** The categories the key hides, the display's `hiddenCategories`. */
  hiddenCategories?: readonly HiddenCategory[]
  frame: StaticMarkFrame
  /** The id the display's SVG ids are built from, unique in the document. */
  id?: string
  opts?: ExportSvgDisplayOptions
}

/**
 * What the exporting view draws beside the plot as the display's key: an
 * `SvgLegend` model, placed and measured by the view's chrome
 * (`svgLegendGutterWidth`).
 */
export interface StaticMarkLegend {
  id: string
  showLegend: boolean
  legendSpec: LegendSpec
}

/**
 * #api
 * A mark display (`LinearMarkDisplay`) as its SVG export draws it, with no
 * session: the fetch the display issues over `frame`, the adapter's row
 * listing where the display draws rows, then the display's own views on a
 * static mark host, then its export body in the display shell. Returns the
 * body and the key the view places beside it. The refNames in `frame` must be
 * the adapter's, and the adapters registered on `pluginManager`.
 */
export async function staticMarkSvg(
  pluginManager: PluginManager,
  {
    adapterConfig,
    display = {},
    hiddenCategories,
    frame,
    id = 'static-mark',
    opts,
  }: StaticMarkSvgArgs,
) {
  const model = createMarkStaticHost(pluginManager, {
    id,
    display,
    hiddenCategories,
  })
  model.setFrame(frame)
  const fetchInputs = runInAction(() => ({
    request: model.plotRequest(),
    visible: model.markView.visible,
    drawsRows: model.drawsRows,
  }))
  const { request } = fetchInputs
  const asked = { adapterConfig, ...request, bpPerPx: frame.bpPerPx }
  const regions = binnedFetchRegions(
    frame.bufferedVisibleRegions,
    request,
    fetchInputs.visible,
    frame.displayedRegions,
  )
  const [listing, payloads] = await Promise.all([
    fetchInputs.drawsRows
      ? executeGetRowSources({
          pluginManager,
          args: { adapterConfig, sessionId: id },
        })
      : undefined,
    Promise.all(
      regions.map(async ({ region, displayedRegionIndex }) => {
        const result = await executeGetEncodedLayers({
          pluginManager,
          args: {
            ...asked,
            region,
            sessionId: id,
            statusCallback: () => {},
          },
        })
        if (isRegionRefused(result)) {
          throw new Error(`region ${region.refName} is too large to export`)
        }
        const payload: MarkRegionData = {
          ...storedRegionData(result.value),
          request: { ...asked, region },
        }
        return { displayedRegionIndex, payload }
      }),
    ),
  ])
  model.setFetched(
    new Map(payloads.map(p => [p.displayedRegionIndex, p.payload])),
    listing,
  )
  const drawn = runInAction(() => {
    const { svgSidebar } = model
    const body: MarkSvgBodyModel = {
      id,
      height: model.height,
      regionTooLarge: false,
      svgSidebarWidth: (text?: ExportTextStyle) =>
        svgSidebar ? svgSidebarWidth(svgSidebar, text) : 0,
      markList: model.markList,
      markTypes: model.markTypes,
      textMarkEntries: model.textMarkEntries,
      rpcDataMap: model.rpcDataMap,
      renderState: model.renderState,
      plotBox: model.plotBox,
      facetLayout: model.facetLayout,
      effectiveRowHeight: model.effectiveRowHeight,
      drawsRows: model.drawsRows,
      showRowSeparators: model.showRowSeparators,
      nrow: model.nrow,
      scrollTop: model.scrollTop,
      svgSidebar,
      axes: model.axes,
      canvasWidthPx: model.canvasWidthPx,
    }
    const legend: StaticMarkLegend = {
      id,
      showLegend: model.showLegend,
      legendSpec: model.legendSpec,
    }
    return { body, legend }
  })
  return {
    svg: renderDisplaySvgInFrame(drawn.body, frame, opts, MarkSvgBody),
    legend: drawn.legend,
  }
}
