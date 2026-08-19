/**
 * How a synteny match draws its CIGAR ops: 'full' colors indel wedges,
 * 'matches' leaves indels see-through (transparent), 'off' draws blocks only.
 * `[value, menu label]`, in menu order.
 *
 * Here rather than beside the menu that renders it because the website's figure
 * recipes name these labels in a click path, and the node script that builds
 * them cannot load a module importing React, MUI or a lazy `.tsx`. A leaf module
 * makes the recipe import the label instead of retyping it.
 */
export const CIGAR_MODE_OPTIONS = [
  { value: 'full', label: 'Colored indels' },
  { value: 'matches', label: 'Transparent indels' },
  { value: 'off', label: 'None' },
] as const

export type CigarMode = (typeof CIGAR_MODE_OPTIONS)[number]['value']
