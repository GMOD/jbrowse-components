/**
 * Algorithmically pick a contrasting text color that will
 * be visible on top of the given background color. Either
 * black or white.
 *
 * @param {string} rgb color string
 * @returns {string} 'black' or 'white'
 */
export function contrastingTextColor(rgb: string): string {
  let r
  let g
  let b

  if (/^rgb/.test(rgb)) {
    // parse rgba?(...)
    const triplet = rgb.split(/\(([^)]+)\)/)[1].replace(/ /g, '')
    r = parseInt(triplet.split(',')[0], 10)
    g = parseInt(triplet.split(',')[1], 10)
    b = parseInt(triplet.split(',')[2], 10)
  } else {
    // parse hex
    const triplet = rgb.replace('#', '')
    if (triplet.length !== 6) throw new Error(`invalid hex color "${rgb}"`)
    r = parseInt(triplet.substr(0, 2), 16)
    g = parseInt(triplet.substr(2, 2), 16)
    b = parseInt(triplet.substr(4, 2), 16)
  }

  const luminance =
    (Math.round(r * 299) + Math.round(g * 587) + Math.round(b * 114)) / 1000

  return luminance >= 128 ? 'black' : 'white'
}
