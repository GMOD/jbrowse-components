// most zoomed-in level: 50px per bp
export const MIN_BP_PER_PX = 1 / 50

// fraction of the view width the whole genome fills at the most zoomed-out
// level, leaving a 10% margin
export const SHOW_ALL_REGIONS_FILL = 0.9

export const HEADER_BAR_HEIGHT = 48
export const HEADER_OVERVIEW_HEIGHT = 20
export const SCALE_BAR_HEIGHT = 17
// Half-height of the total-bp scalebar's end caps in the SVG export; also the
// clearance the bar needs below the assembly label.
export const SVG_SCALEBAR_CAP = 5
// The three pieces of chrome TrackContainer puts around a track's rendering
// container. The model sums them to place a track without measuring the DOM, so
// TrackContainer lays its Paper out from these same three and nothing else —
// the previous spelling had the model on a 3 while the CSS rendered 2 + 1 + 4,
// which put every model-derived track offset 5px per track above the pixels.
// The track *label* is deliberately not among them; see `trackChromeHeight`.
export const RESIZE_HANDLE_HEIGHT = 4
export const TRACK_TOP_GAP = 2
export const TRACK_OUTLINE_BORDER = 1
export const MINIMIZED_TRACK_HEIGHT = 20
export const SPACING = 7
export const WIDGET_HEIGHT = 32
