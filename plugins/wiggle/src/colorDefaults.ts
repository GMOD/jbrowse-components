import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'

// The negative color is a clean, saturated red rather than a muted coral so
// that at high density (many thin overlapping bars, e.g. a zoomed-out phyloP
// track) the negative side still reads as red instead of muddying toward brown.
export const WIGGLE_POS_COLOR_DEFAULT = DEFAULT_MARK_COLOR
export const WIGGLE_NEG_COLOR_DEFAULT = '#e01e26'
