import { resolveCategoricalMode } from './colorRamps.ts'

import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'
import type { ColorableTrack } from './trackColors.ts'

export interface ColorByMenuTrack {
  trackId: string
  name: string
  /** the color it draws under `colorBy: 'track'` */
  trackColor: string
  /** whether that color was pinned by hand rather than taken from the palette */
  pinned: boolean
}

/**
 * #api
 * Project a view carrying `TrackColorsMixin` onto the menu builder's input.
 * Both palette menus were building this by hand, walking the model's tracks a
 * third time (after `colorableTracks` and the legend) and repeating the same
 * setter lambdas.
 */
export function colorByMenuTargetFor(
  model: TrackColorsModel,
  {
    pointBased,
    showReference,
  }: { pointBased: boolean; showReference: boolean },
): ColorByMenuTarget {
  return {
    colorBy: model.colorByMode,
    attributes: model.colorableAttributes,
    attributeRanges: model.attributeRanges,
    tracks: model.colorableTracks.map(({ trackId, name, color }) => ({
      trackId,
      name,
      trackColor: model.trackColorFor(trackId),
      pinned: color !== undefined,
    })),
    pointBased,
    showReference,
    categorical:
      resolveCategoricalMode(model.colorByMode, model.attributeRanges) !==
      undefined,
    hideUnlabelled: model.hideUnlabelled,
    setColorBy: value => {
      model.setColorBy(value)
    },
    setHideUnlabelled: value => {
      model.setHideUnlabelled(value)
    },
    setTrackColor: (trackId, value) => {
      model.setTrackColor(trackId, value)
    },
    clearTrackColors: () => {
      model.clearTrackColors()
    },
  }
}

// The slice of a TrackColorsMixin-bearing view the adapter reads. Structural
// rather than the concrete view model: dotplot and linear synteny both satisfy
// it, and naming either here would drag a plugin type into this package.
export interface TrackColorsModel {
  colorableTracks: ColorableTrack[]
  colorableAttributes: string[]
  attributeRanges: Record<string, AttributeRange>
  colorByMode: SyntenyColorBy
  hideUnlabelled: boolean
  trackColorFor: (trackId: string) => string
  setColorBy: (value: SyntenyColorBy) => void
  setHideUnlabelled: (value: boolean) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
}

export interface ColorByMenuTarget {
  colorBy: SyntenyColorBy
  tracks: ColorByMenuTrack[]
  /**
   * numeric columns the overlaid tracks declare, each offered as its own mode.
   * Taken from the track config rather than from the data so the menu is right
   * before anything has loaded.
   */
  attributes: string[]
  /**
   * the span each channel has been seen to cover. A preset measurement is
   * offered only once the loaded data has carried one value of it: a plain
   * PAF has no dN/dS, and a CIGAR-less one no identity, so the row says so
   * rather than painting every ribbon the missing-data color.
   */
  attributeRanges: Record<string, AttributeRange>
  /** dotplots draw flat points and have no 'reference' anchor */
  pointBased: boolean
  /** 'reference' is meaningless below two stacked levels */
  showReference: boolean
  /** whether the current mode paints a text column, which is when the unlabelled rows can be hidden */
  categorical: boolean
  hideUnlabelled: boolean
  setColorBy: (value: SyntenyColorBy) => void
  setHideUnlabelled: (value: boolean) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
}
