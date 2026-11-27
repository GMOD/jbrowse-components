---
name: a-link-far-foot-places-in-another-assemblys-region
description: "On a mark display over two assemblies, a link's far foot draws into the other assembly's region when that region covers its position, and a foot on no displayed region hovers under an arbitrary assembly's spelling; both want the own assembly first."
---

# A link's far foot places in another assembly's region

`withMateRegions` in
[`linkOwners.ts`](../../../plugins/marks/src/LinearMarkDisplay/linkOwners.ts)
resolves each far foot to a displayed region: the block's own region if it
holds the foot, else any displayed region on any of the track's assemblies
that does (`onRef.find(holds)`). So a foot lands in another assembly's region
that covers its position, even when its own assembly has the contig off
screen.

A reviewer's probe reproduced it (2026-11-27): a track on P (`chr1`) and Q
(`1`) showing P `chr1:0-1000` and Q `1:4000-6000` draws P's pair
`chr1:100`–`5000` into Q's region, at a position in the other assembly's
coordinates.

The hover has the same gap. `x2CanonicalRefNames` spells a far refName as the
block's own assembly's region names it, else as `found[0]` does, which is
whichever assembly comes first, unrecorded. It cannot mix spans, since the
refName differs.

## The fix

- Place through the block's own assembly's regions before any other
  assembly's, and spell a refName the own assembly has no region for through
  its aliases (`canonical(ownAssembly, name)`) before taking `found[0]`.
  Nothing on a record says it crosses assemblies, so the own assembly is the
  reading a record supports.
- Before changing it, read `1f755c2c9a`, which placed a far foot on any
  region, and `badee04f11`, which made the hover spelling follow another
  assembly's region; neither commit message says the cross-assembly reach
  was wanted for placement.
- Pin it with a `linkOwners.test.ts` case built from the probe above.
