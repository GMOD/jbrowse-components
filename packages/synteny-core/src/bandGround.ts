import { getPaletteHost } from '@jbrowse/core/util'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #api
 * The colour a comparative band is painted on, for every surface that has to
 * agree about it.
 *
 * `background.paper` rather than `background.default`: the band is a sheet the
 * views sit on, the same slot the multi-way lane bands already use.
 *
 * ONE decision in one place because the band's ground is not a background — the
 * renderers BAKE it into the pixels. An indel wedge is pre-blended against it
 * and written opaque so it agrees with the base ribbon composited beside it, and
 * every mark, tick, label halo and outline is `getContrastText` of it. A surface
 * that resolves its own ink off the theme while the clear says something else is
 * the bug that shipped the off-screen-mate strip invisible under a dark theme.
 * `LinearSyntenyDisplay/Canvas2DSyntenyRenderer.clear` is the arithmetic.
 */
export function bandGroundColor(node: IAnyStateTreeNode) {
  return getPaletteHost(node).palette.background.paper
}
