// In their own leaf module so the settings menu (a separate lazy chunk from
// the lazily loaded state model) can read them without merging the two chunks.
// Exported because the settings menu's slider rows carry a reset-to-default
// button, and a default spelled twice is a reset that silently stops agreeing
// with the property it resets.
export const DEFAULT_OVERDRAW_PX = 1000
export const DEFAULT_ALPHA = 0.2
export const DEFAULT_MIN_ALIGNMENT_LENGTH = 0
