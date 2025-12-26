export const f2 = 0.3

// Variant rendering colors
export const REFERENCE_COLOR = '#ccc'
export const NO_CALL_COLOR = 'hsl(50,50%,50%)'
export const UNPHASED_COLOR = 'black'

// Allele count mode colors (HSL values)
export const ALT_COLOR_HUE = 200
export const ALT_COLOR_SATURATION = 50
export const OTHER_ALT_COLOR = 'hsl(0,100%,20%)'

// Helper to get alt color based on dosage (0-1)
export function getAltColorForDosage(dosage: number) {
  const lightness = 80 - dosage * 50
  return `hsl(${ALT_COLOR_HUE},${ALT_COLOR_SATURATION}%,${lightness}%)`
}
