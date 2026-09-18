import type { ColorModeSurface } from './colorModes.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { ColorableTrack } from './trackColors.ts'

export interface ColorByMenuTrack {
  trackId: string
  name: string
  /** the color it draws under `colorBy: { field: 'track' }` */
  trackColor: string
  /** whether that color was pinned by hand rather than taken from the palette */
  pinned: boolean
}

/**
 * #api
 * Project a view carrying `TrackColorsMixin` onto the menu builder's input.
 * `track` is offered once two tracks overlay, and `reference` only across a
 * stack of two or more levels, since below that it degenerates to query or
 * target.
 */
export function colorByMenuTargetFor(
  model: TrackColorsModel,
  {
    pointBased,
    showReference,
  }: { pointBased: boolean; showReference: boolean },
): ColorByMenuTarget {
  const tracks = model.colorableTracks.map(({ trackId, name, color }) => ({
    trackId,
    name,
    trackColor: model.trackColorFor(trackId),
    pinned: color !== undefined,
  }))
  return {
    colorBy: model.colorByField,
    structuralFields: [
      '',
      'strand',
      ...(tracks.length > 1 ? ['track'] : []),
      'query',
      'target',
      ...(showReference ? ['reference'] : []),
    ],
    attributes: model.colorableAttributes,
    attributeRanges: model.attributeRanges,
    surface: pointBased ? 'points' : 'ribbons',
    hideUnlabelled: model.hideUnlabelled,
    colorDomain: model.colorDomain,
    setColorBy: field => {
      model.setColorBy(field)
    },
    setHideUnlabelled: value => {
      model.setHideUnlabelled(value)
    },
    setColorDomain: domain => {
      model.setColorDomain(domain)
    },
    trackColors: {
      tracks,
      setTrackColor: (trackId, value) => {
        model.setTrackColor(trackId, value)
      },
      clearTrackColors: () => {
        model.clearTrackColors()
      },
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
  colorByField: string
  hideUnlabelled: boolean
  colorDomain: readonly string[]
  trackColorFor: (trackId: string) => string
  setColorBy: (field: string) => void
  setHideUnlabelled: (value: boolean) => void
  setColorDomain: (domain: string[]) => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
}

export interface ColorByMenuTarget {
  /** the field the surface paints by, `''` for its default colour */
  colorBy: string
  /** the structural fields the surface paints, in `COLOR_MODES` order */
  structuralFields: readonly string[]
  /**
   * columns the tracks declare, each offered as its own mode. Taken from the
   * track config rather than from the data so the menu is right before
   * anything has loaded.
   */
  attributes: readonly string[]
  /**
   * the span or label list each channel has been seen to cover. A preset
   * measurement is offered only once the loaded data has carried one value of
   * it: a plain PAF has no dN/dS, and a CIGAR-less one no identity.
   */
  attributeRanges: Record<string, AttributeRange>
  /** what draws the alignments, which some modes' help describes differently */
  surface: ColorModeSurface
  hideUnlabelled: boolean
  /** the order a text column's labels take, which Pin distinct colors writes */
  colorDomain: readonly string[]
  setColorBy: (field: string) => void
  setHideUnlabelled: (value: boolean) => void
  setColorDomain: (domain: string[]) => void
  /** the per-track swatches of a view overlaying tracks */
  trackColors?: {
    tracks: ColorByMenuTrack[]
    setTrackColor: (trackId: string, value: string | undefined) => void
    clearTrackColors: () => void
  }
}
