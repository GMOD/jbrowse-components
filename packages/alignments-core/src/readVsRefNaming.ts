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
  now,
  rand,
}: {
  readName: string
  trackAssembly: string
  // Injected for testability; production passes Date.now and Math.random.
  now: () => number
  rand: () => number
}) {
  const shortName = truncateMiddle(readName)
  // A uniquifier for the ids only: nothing built here puts it in front of a
  // reader, which is what readAssemblyDisplayName is for.
  //
  // Minted here rather than taken as an argument, because `now()` alone is not
  // unique and both launchers passed exactly that. It is millisecond
  // resolution, so the same read launched twice inside one millisecond named
  // one temporary assembly — `addTemporaryAssembly` warns and hands back the
  // FIRST, and the second view draws its ribbons against an axis of the wrong
  // totalLength. The clock still leads, so a session snapshot reads in launch
  // order. `buildDerivativeVsRefSpec` reached the same shape separately.
  const stamp = `${now()}-${Math.floor(rand() * 1e6)}`
  return {
    shortName,
    // Per-launch unique: relaunching on the same read must not collide with the
    // temporary assembly the previous view registered and still owns.
    readAssembly: `${readName}_assembly_${stamp}`,
    // What that assembly is CALLED on screen. The name above is an id and reads
    // like one, but it is also what a panel header shows (through
    // assemblyManager.getDisplayName), so the launched view used to be labelled
    // with a wall-clock timestamp. Two launches on the same read share a display
    // name, which is correct: they are the same read.
    readAssemblyDisplayName: shortName,
    seqTrackId: `${readName}_${stamp}`,
    syntenyTrackId: `track-${stamp}`,
    syntenyTrackName: `${shortName}_vs_${trackAssembly}`,
    displayName: `${shortName} vs ${trackAssembly}`,
  }
}
