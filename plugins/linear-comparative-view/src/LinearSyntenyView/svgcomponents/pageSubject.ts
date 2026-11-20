import { svgLegendGutterWidth } from '@jbrowse/display-kit/renderDisplaySvg'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { PageLayoutSubject } from '@jbrowse/plugin-linear-genome-view'

/**
 * A synteny export on a page: its genome rows share the plot width, and the
 * view's key sits in the legend gutter beside the first ribbon band.
 */
export function syntenyPageSubject(
  model: LinearSyntenyViewModel,
): PageLayoutSubject {
  return {
    node: model,
    views: model.views,
    legendWidth: theme => {
      const firstLevel = model.levels[0]
      return firstLevel
        ? svgLegendGutterWidth(model, theme, firstLevel.height)
        : 0
    },
  }
}
