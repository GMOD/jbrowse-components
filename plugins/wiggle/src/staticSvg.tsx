import { renderDisplaySvgInFrame } from '@jbrowse/display-kit/renderDisplaySvg'
import { svgSidebarWidth } from '@jbrowse/tree-sidebar'
import { runInAction } from 'mobx'

import { WiggleSvgBody } from './LinearWiggleDisplay/renderSvg.tsx'
import { executeRenderMultiWiggleData } from './RenderMultiWiggleDataRPC/executeRenderMultiWiggleData.ts'
import {
  createWiggleStaticHost,
  wiggleTrackTypeOf,
} from './shared/wiggleStaticHost.ts'

import type { WiggleSvgBodyModel } from './LinearWiggleDisplay/renderSvg.tsx'
import type {
  WiggleStaticFrame,
  WiggleTrackType,
} from './shared/wiggleStaticHost.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Region } from '@jbrowse/core/util/types'
import type { BufferedVisibleRegion } from '@jbrowse/display-kit/regionHost'
import type { SvgViewFrame } from '@jbrowse/display-kit/renderDisplaySvg'
import type {
  ExportSvgDisplayOptions,
  ExportTextStyle,
} from '@jbrowse/display-kit/types'
import type React from 'react'

/**
 * The view a static wiggle export reads: where it draws, which blocks it
 * autoscales over, and what it fetches at which zoom. `staticLgvFrame` builds
 * one from a region list and a width.
 */
export interface StaticWiggleFrame extends SvgViewFrame, WiggleStaticFrame {
  bpPerPx: number
  bufferedVisibleRegions: BufferedVisibleRegion[]
}

export interface StaticWiggleSvgArgs {
  adapterConfig: Record<string, unknown>
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearWiggleDisplay`. Unset reads the default display.
   */
  display?: Record<string, unknown>
  frame: StaticWiggleFrame
  /** The id the display's SVG ids are built from, unique in the document. */
  id?: string
  opts?: ExportSvgDisplayOptions
  /**
   * The fetched regions in the file's spelling, as `renameRegionsIfNeeded`
   * renames a session's request, for a file naming its contigs other than
   * the assembly does. Unset, the frame's names are fetched as they are.
   */
  renameRegions?: (regions: Region[]) => Promise<Region[]>
  /**
   * The track type whose display defaults `display` fills from. Unset, a
   * `MultiWiggleAdapter` reads as a `MultiQuantitativeTrack`.
   */
  trackType?: WiggleTrackType
}

/**
 * What a static wiggle export drew: the display box the view's chrome lays
 * out (its height, sidebar, label placement and key) and the body in it.
 */
export interface StaticWiggleDisplay {
  display: WiggleSvgBodyModel & {
    prefersOffset: boolean
    showLegend: boolean
    legendSpec: LegendSpec
    legendSpecIn: (palette: JBrowsePalette) => LegendSpec
  }
  body: React.ReactNode
}

/**
 * #api
 * A quantitative track's display as its SVG export draws it, with no session:
 * the fetch the display issues over `frame`, then the display's own views on
 * the wiggle static host, then its export body in the display shell. The
 * frame's regions are the assembly's, as a view's are; `renameRegions` puts
 * them in the file's names for the fetch. The adapters must be registered on
 * `pluginManager`.
 */
export async function staticWiggleSvg(
  pluginManager: PluginManager,
  args: StaticWiggleSvgArgs,
) {
  return (await staticWiggleDisplay(pluginManager, args)).body
}

/**
 * {@link staticWiggleSvg} with the display box it drew, for a caller laying
 * the track out in a view's export (`staticLgvSvg`).
 */
export async function staticWiggleDisplay(
  pluginManager: PluginManager,
  {
    adapterConfig,
    display = {},
    frame,
    id = 'static-wiggle',
    opts,
    renameRegions = async regions => regions,
    trackType = wiggleTrackTypeOf(adapterConfig),
  }: StaticWiggleSvgArgs,
): Promise<StaticWiggleDisplay> {
  const model = createWiggleStaticHost({ trackType, id, display })
  const fetchInputs = runInAction(() => ({
    resolution: model.resolution,
    yField: model.yField,
  }))
  const fetched = frame.bufferedVisibleRegions
  const results = (
    await executeRenderMultiWiggleData({
      pluginManager,
      args: {
        sessionId: id,
        adapterConfig,
        regions: await renameRegions(fetched.map(b => b.region)),
        bpPerPx: frame.bpPerPx,
        ...fetchInputs,
        statusCallback: () => {},
      },
    })
  ).value
  model.setFetched(
    frame,
    new Map(fetched.map((b, i) => [b.displayedRegionIndex, results[i]!])),
  )
  const drawn = runInAction(() => {
    const gpuProps = model.gpuProps()
    const { svgSidebar } = model
    return {
      id,
      height: model.height,
      regionTooLarge: false,
      rpcDataMap: model.rpcDataMap,
      renderState: model.renderState,
      gpuProps: () => gpuProps,
      plotGeometry: model.plotGeometry,
      svgSidebar,
      svgSidebarWidth: (text?: ExportTextStyle) =>
        svgSidebarWidth(svgSidebar, text),
      axes: model.axes,
      canvasWidthPx: model.canvasWidthPx,
      isOverlay: model.isOverlay,
      isDensityMode: model.isDensityMode,
      showRowSeparators: model.showRowSeparators,
      effectiveRowHeight: model.effectiveRowHeight,
      numRows: model.numRows,
      rowsTopOffset: model.rowsTopOffset,
      svgControlsStrip: model.svgControlsStrip,
      prefersOffset: model.prefersOffset,
      showLegend: model.showLegend,
      legendSpec: model.legendSpec,
      legendSpecIn: (palette: JBrowsePalette) => model.legendSpecIn(palette),
    }
  })
  return {
    display: drawn,
    body: renderDisplaySvgInFrame(drawn, frame, opts, WiggleSvgBody),
  }
}
