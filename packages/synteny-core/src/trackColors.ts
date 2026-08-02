// Qualitative palette for telling OVERLAID TRACKS apart within one view.
//
// Purpose-built rather than assembled from `paletteColors`: every general
// palette carries a grey, and a grey ribbon reads as "uncolored/broken" rather
// than as a track identity (the same reason syntenyColors.ts filters #7f7f7f
// out of the by-refName palette). Ordered so the first entries are the most
// separated in hue — two overlaid tracks is the common case and gets
// blue/orange, and hue only starts repeating past ~8 tracks.
//
// Deliberately NOT the by-refName palette (nameColorPalette / getQueryColor).
// Those hash a contig name to a color stable across every view; this one is
// positional and view-scoped, and sharing them would make a track's color
// depend on an unrelated view's contig names.
export const syntenyTrackPalette: readonly string[] = [
  '#4e79a7', // blue
  '#f28e2c', // orange
  '#59a14f', // green
  '#e15759', // red
  '#b07aa1', // purple
  '#76b7b2', // teal
  '#edc949', // yellow
  '#ff9da7', // pink
  '#9c755f', // brown
  '#1b9e77', // sea green
  '#7570b3', // slate
  '#d95f02', // burnt orange
  '#e7298a', // magenta
  '#66a61e', // olive
  '#386cb0', // indigo
  '#a6761d', // gold
]

// What the palette needs: an identity and whether the user already pinned it.
// Names are irrelevant to the assignment, so they aren't required here.
export interface PalettableTrack {
  trackId: string
  /** explicit user pin, if any */
  color?: string
}

// A palettable track plus the label the legend and the palette menu show.
export interface ColorableTrack extends PalettableTrack {
  name: string
}

/**
 * #api
 * Map each overlaid track to the color it draws in under `colorBy: 'track'`.
 *
 * Two passes so an automatic slot never duplicates a color the user pinned by
 * hand: pass one reserves every explicit color, pass two hands each remaining
 * track the next palette entry that isn't reserved. Past the end of the palette
 * it wraps rather than falling back to a hash — a hashed color collides ~20% of
 * the time at four tracks, and distinguishability is the whole point.
 *
 * Positional, so colors reshuffle when tracks are added, hidden, or reordered.
 * That is intended: this is a within-view distinguishability aid, not a stable
 * identity. Anything worth keeping gets pinned.
 */
export function assignTrackColors(
  tracks: readonly PalettableTrack[],
): Map<string, string> {
  const pinned = new Set(
    tracks.map(t => t.color).filter((c): c is string => c !== undefined),
  )
  const out = new Map<string, string>()
  let next = 0
  for (const { trackId, color } of tracks) {
    if (color === undefined) {
      // Skip entries a pin already claimed. Bounded by the palette length so a
      // palette fully claimed by pins still terminates, handing out a duplicate
      // rather than spinning.
      let skipped = 0
      while (
        skipped < syntenyTrackPalette.length &&
        pinned.has(syntenyTrackPalette[next % syntenyTrackPalette.length]!)
      ) {
        next++
        skipped++
      }
      out.set(trackId, syntenyTrackPalette[next % syntenyTrackPalette.length]!)
      next++
    } else {
      out.set(trackId, color)
    }
  }
  return out
}
