import type { ColorModeSurface, SyntenyColorSurface } from './colorModes.ts'
import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'
import type { ColorableTrack } from './trackColors.ts'

export interface ColorByMenuTrack {
  trackId: string
  name: string
  /** the color it draws under `encoding.color: 'track'` */
  trackColor: string
  /** whether that color was pinned by hand rather than taken from the palette */
  pinned: boolean
}

/**
 * #api
 * Project a view with `TrackColorsMixin` onto the menu builder's input.
 * `track` is offered once two tracks overlay, and `reference` where the view
 * has a reference to anchor on.
 */
export function colorByMenuTargetFor(
  model: TrackColorsModel,
): ColorByMenuTarget {
  const tracks = model.colorableTracks.map(({ trackId, name, color }) => ({
    trackId,
    name,
    trackColor: model.trackColorFor(trackId),
    pinned: color !== undefined,
  }))
  return {
    field: model.colorField,
    structuralFields: [
      ...(model.impliedColorField === undefined ? [undefined] : []),
      'strand',
      ...(tracks.length > 1 ? ['track'] : []),
      'query',
      'target',
      ...(model.offersReferenceColor() ? ['reference'] : []),
    ],
    attributes: model.colorableAttributes,
    attributeRanges: model.attributeRanges,
    paint: model.colorPaint,
    surface: model.colorSurface(),
    hideUnlabelled: model.hideUnlabelled,
    setColorField: field => {
      model.setColorField(field)
    },
    setHideUnlabelled: value => {
      model.setHideUnlabelled(value)
    },
    solidColor: {
      checked: model.colorField === undefined && model.colorValue !== undefined,
      pick: () => {
        model.openSolidColorDialog()
      },
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
  colorPaint: SyntenyColorPaint
  colorField: string | undefined
  impliedColorField: string | undefined
  colorValue: string | undefined
  hideUnlabelled: boolean
  trackColorFor: (trackId: string) => string
  colorSurface: () => SyntenyColorSurface
  offersReferenceColor: () => boolean
  setColorField: (field: string | undefined) => void
  setHideUnlabelled: (value: boolean) => void
  openSolidColorDialog: () => void
  setTrackColor: (trackId: string, value: string | undefined) => void
  clearTrackColors: () => void
}

export interface ColorByMenuTarget {
  /** the field the surface paints by, undefined for its default color */
  field: string | undefined
  /** the structural fields the surface paints, in `COLOR_MODES` order */
  structuralFields: readonly (string | undefined)[]
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
  /** what the channel's `scale` writes, whose `type` can override the kind read off the data */
  paint?: SyntenyColorPaint
  /** what draws the alignments, which some modes' help describes differently */
  surface: ColorModeSurface
  hideUnlabelled: boolean
  setColorField: (field: string | undefined) => void
  setHideUnlabelled: (value: boolean) => void
  /** whether a constant paints, and the picker Solid color... opens */
  solidColor?: { checked: boolean; pick: () => void }
  /** the per-track swatches of a view overlaying tracks */
  trackColors?: {
    tracks: ColorByMenuTrack[]
    setTrackColor: (trackId: string, value: string | undefined) => void
    clearTrackColors: () => void
  }
}
