import { coarseStripHTML } from '@jbrowse/core/util'
import { buildSearchText } from '@jbrowse/core/util/searchText'

/**
 * The text one of the track selectors' filter boxes matches a track against.
 *
 * *Which* fields a selector puts in is its own call: the table grid includes
 * every column it renders, and the tree leaves out the kind and adapter,
 * naming any description or metadata hit beside the row. Track names and descriptions
 * draw as markup, so it is stripped: searching `i` should not hit a track
 * named `<i>foo</i>`. The rest is core's `buildSearchText`, shared with every
 * table's search box so a query means the same everywhere.
 */
export function buildTrackSearchText(fields: unknown[]) {
  return buildSearchText([
    coarseStripHTML(
      fields.filter(f => f !== undefined && f !== null).join('\n'),
    ),
  ])
}
