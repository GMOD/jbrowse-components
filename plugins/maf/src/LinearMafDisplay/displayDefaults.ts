// Defaults shared by the state model and the track menu presets, in a module of
// their own to avoid a stateModel/trackMenuItems import cycle.
export const DEFAULTS = {
  // Px height of the "Normal" preset; the `rowHeight` property itself defaults
  // to 0 (fit to display height).
  rowHeight: 15,
  height: 300,
  rowProportion: 0.8,
  showAlignments: true,
} as const

// Each preset pairs a row height with the glyph proportion that reads best at
// it; maf is the one display with this second axis.
export const HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: DEFAULTS.rowHeight, rowProportion: 0.8 },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]
