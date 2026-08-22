import type { ExportSvgOptions } from '../LinearGenomeView/types.ts'
import type TrackHeightMixin from './models/TrackHeightMixin.tsx'
import type { DisplayModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

/**
 * A display shown in a linear-genome-view track: the core `DisplayModel` plus
 * the `height`/`resizeHeight` from `TrackHeightMixin` that every linear display
 * composes. `prefersOffset` is an optional per-display convention. LGV track
 * containers legitimately narrow `track.activeDisplay` to this — the plugin
 * union on `BaseTrackModel.displays` can't express it statically.
 */
export type LinearDisplayModel = DisplayModel &
  Instance<ReturnType<typeof TrackHeightMixin>> & {
    prefersOffset?: boolean
  }

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  theme?: ThemeOptions
  legendWidth?: number
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}
