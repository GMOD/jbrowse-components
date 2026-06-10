
  Verdict: no genuine dead code remains

  I ran a full unused-export scan across the whole alignments plugin and verified each hit. The
  result:

  - Nothing is truly dead — every flagged symbol is referenced at least within its own file.
  - Most flags are types required by exported signatures (must stay exported).
  - The only genuine over-exports are a handful of internal value constants/helpers that no other file
  imports: SASHIMI_FORWARD/REVERSE/UNKNOWN, LINKED_READ_COLOR_PAIR_UNKNOWN, CLIP_KIND_SOFT/HARD,
  packClips, splitColorType. These could have export dropped, but it's purely cosmetic (used
  internally, ESLint doesn't flag them, zero behavioral effect) and the files are unrelated to the arc
  work — sweeping them now would be cross-cutting churn in a shared worktree for no functional gain.

  The real dead code was already removed in the arc commit:
  - the arcLineColor0/1 UBO slots + arcLineColorPalette,
  - ArcsDataResult's three always-empty coverage* fields,
  - the degenerate per-line y path,
  - and the dead nextRef !== refName → interchrom branch (which we revived rather than deleted, since
  it turned out to be the lost feature).

  So I'd stop here — there's nothing dead left to delete that's worth the churn. If you specifically
  want the API surface of those ~7 internal constants tightened, I can do that as an isolated pass,
  but I wouldn't fold it into the arc work.

