/**
 * @param {string} rgb color string
 * @returns {string} 'black' or 'white'
 */
export function contrastingTextColor(rgb) {
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

/**
 * given a displayed region and an iterable of features that overlap it,
 * assemble the region's sequence from the sequences returned by each feature.
 */
export function featuresConsensusSequence(region, features) {
  // insert the `replacement` string into `str` at the given
  // `offset`, putting in `length` characters.
  function replaceAt(str, offset, replacement) {
    let rOffset = 0
    if (offset < 0) {
      rOffset = -offset
      offset = 0
    }

    const length = Math.min(str.length - offset, replacement.length - rOffset)

    return (
      str.substr(0, offset) +
      replacement.substr(rOffset, length) +
      str.substr(offset + length)
    )
  }

  // pad with spaces at the beginning of the string if necessary
  const len = region.end - region.start
  let sequence = ''
  while (sequence.length < len) sequence += ' '

  for (const f of features) {
    const seq = f.get('residues') || f.get('seq')
    if (seq) sequence = replaceAt(sequence, f.get('start') - region.start, seq)
  }
  return sequence
}
