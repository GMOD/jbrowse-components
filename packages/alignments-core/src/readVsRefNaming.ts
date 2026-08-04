import { truncateMiddle } from '@jbrowse/core/util'

// The ids and labels one "read vs ref" launch mints, shared by the linear
// synteny and dotplot launchers so the synthetic assembly they register cannot
// drift apart, and so the read name is shortened for display in exactly one
// place. Read names are routinely long — a 36-character ONT UUID, a PacBio
// `movie/zmw/ccs` — and untruncated they crowd out the view title and the
// track name they are pasted into.
export function buildReadVsRefNames({
  readName,
  trackAssembly,
  stamp,
}: {
  readName: string
  trackAssembly: string
  // Date.now() at launch. Only ever a uniquifier, never displayed on its own.
  stamp: number
}) {
  const shortName = truncateMiddle(readName)
  return {
    shortName,
    // Per-launch unique: relaunching on the same read must not collide with the
    // temporary assembly the previous view registered and still owns.
    readAssembly: `${readName}_assembly_${stamp}`,
    seqTrackId: `${readName}_${stamp}`,
    syntenyTrackId: `track-${stamp}`,
    syntenyTrackName: `${shortName}_vs_${trackAssembly}`,
    displayName: `${shortName} vs ${trackAssembly}`,
  }
}
