// stripDefault baselines: a snapshot omits these unless the user changed them.
// In their own leaf module so launchers and menus can read them without
// pulling the whole (lazily loaded) state model into their chunk.

// exported so a launcher building a DotplotView snapshot can size its initial
// bpPerPx against the height the view will actually come up at
export const defaultHeight = 600
// Exported because the settings menu's slider rows carry a reset-to-default
// button, and a default spelled twice is a reset that silently stops agreeing
// with the property it resets.
export const DEFAULT_LINE_WIDTH = 2.5
export const DEFAULT_ALPHA = 1
export const DEFAULT_MIN_ALIGNMENT_LENGTH = 0
export const DEFAULT_MIN_IDENTITY = 0
