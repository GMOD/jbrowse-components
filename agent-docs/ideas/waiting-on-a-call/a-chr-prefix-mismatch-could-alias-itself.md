---
name: a-chr-prefix-mismatch-could-alias-itself
description: A hosted hg38 config plus a user's 1/2/3 BAM is the commonest refName mismatch, and a web non-admin cannot add the alias that fixes it. When the two sets differ only by a chr prefix (MT against chrM too), the browser could alias them itself; where the alias lives and whether it is announced are the call.
---

# A chr-prefix mismatch could alias itself

The commonest refName mismatch is a hosted hg38 config (UCSC names, `chr1`) and
a user's own BAM or VCF (Ensembl names, `1`). The warning in
`refname-mismatch-warning-visibility.md` ends in the same place for that user:
add a `refNameAliases` entry to the assembly. A web non-admin cannot, because a
config.json assembly is read-only to them, so what the warning can offer them
is a request to the site admin.

`detectRefNameMismatch` (`packages/core/src/assemblyManager/refNameMismatch.ts`)
only checks that the two name sets share nothing. It has no chr-prefix rule: the
file's `1`, `2`, `3` never resolve to `chr1`, `chr2`, `chr3`, and the
mitochondrion is the one name that is not a prefix swap at all (`MT` against
`chrM`). Auto-aliasing when the mismatch is only a chr prefix would fix the
track with no action from the user.

## Open questions

- **Where the alias lives.** Session-only (a session assembly's aliases, saved
  with the session) leaves the hosted config alone and is the only place a
  non-admin can write. Per track would not reach a second track from the same
  file. Writing the config is the admin's and stays theirs.
- **Silent or announced.** Silent is the fix with no friction, but a track that
  starts drawing under an alias nobody chose is a surprise when it is wrong.
  Announced (a notice on the track, or the warning turning into "matched by
  adding the chr prefix, undo") keeps the user in the loop and costs one more
  surface.
- **False-positive risk.** `1` against `chr1` is safe; a file whose `1` is a
  contig of a different assembly that happens to be named `chr1` there is not.
  The contig-length check in `contigLengthMismatch` is the natural guard: alias
  only when the lengths agree too, and fall back to the warning when they do
  not. Whether the length check is cheap enough to run before the alias is
  applied is unchecked.

Nothing is built; ask Colin before building. See also
`refname-mismatch-warning-visibility.md`, which is about where the warning shows
and not about whether it should be needed.
