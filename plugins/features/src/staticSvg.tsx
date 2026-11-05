import { DEFAULT_BYTE_LIMIT } from '@jbrowse/core/data_adapters/tables'
import { renderDisplaySvgInFrame } from '@jbrowse/display-kit/renderDisplaySvg'
import { runInAction } from 'mobx'

import { FeaturesSvgBody } from './LinearBasicDisplay/renderSvg.tsx'
import {
  createFeatureStaticHost,
  fetchFeatureRegions,
} from './shared/featureStaticHost.ts'

import type {
  FeaturesSvgBodyModel,
  FeaturesSvgFrame,
} from './LinearBasicDisplay/renderSvg.tsx'
import type {
  FeatureFetchArgs,
  FeatureStaticFrame,
} from './shared/featureStaticHost.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BufferedVisibleRegion } from '@jbrowse/display-kit/regionHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

/**
 * The view a static feature export reads: where it draws, which blocks are
 * on screen, and what it fetches at which zoom. `staticLgvFrame` builds one
 * from a region list and a width.
 */
export interface StaticFeaturesFrame
  extends FeaturesSvgFrame, FeatureStaticFrame {
  bufferedVisibleRegions: BufferedVisibleRegion[]
}

export interface StaticFeaturesSvgArgs extends Omit<
  FeatureFetchArgs,
  'byteLimit'
> {
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearBasicDisplay`. Unset reads the default display.
   */
  display?: Record<string, unknown>
  frame: StaticFeaturesFrame
  /** The id the display's SVG ids are built from, unique in the document. */
  id?: string
  opts?: ExportSvgDisplayOptions
  /** The most compressed bytes a region may need. 200 MB by default. */
  byteLimit?: number
}

/**
 * #api
 * A feature track's display (`LinearBasicDisplay`) as its SVG export draws
 * it, with no session: the fetch the display issues over `frame`'s buffered
 * regions, then the display's own views on the feature static host (its
 * layout, fit ladder, labels and colors), then its export body in the display
 * shell. The track is drawn unscrolled, nothing pinned or expanded. The
 * refNames in `frame` must be the adapter's, and the adapters registered on
 * `pluginManager`.
 */
export async function staticFeaturesSvg(
  pluginManager: PluginManager,
  {
    display = {},
    frame,
    id = 'static-features',
    opts,
    byteLimit = DEFAULT_BYTE_LIMIT,
    ...fetchArgs
  }: StaticFeaturesSvgArgs,
) {
  const host = createFeatureStaticHost({ id, display, pluginManager })
  host.setFrame(frame)
  await fetchFeatureRegions(
    pluginManager,
    host,
    frame.bufferedVisibleRegions.map(b => ({
      region: b.region,
      index: b.displayedRegionIndex,
    })),
    { ...fetchArgs, byteLimit },
  )
  const drawn = runInAction((): FeaturesSvgBodyModel => ({
    id,
    height: host.height,
    regionTooLarge: false,
    laidOutDataMap: host.laidOutDataMap,
    fieldPalette: host.fieldPalette,
    renderState: host.renderState,
    renderedLabels: host.renderedLabels,
    showsGroupLabels: host.showsGroupLabels,
    groupSections: host.groupSections,
  }))
  return renderDisplaySvgInFrame(drawn, frame, opts, FeaturesSvgBody)
}
