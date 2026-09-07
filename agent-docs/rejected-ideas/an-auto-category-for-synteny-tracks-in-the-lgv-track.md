---
name: an-auto-category-for-synteny-tracks-in-the-lgv-track
description: An auto-category for synteny tracks in the LGV track selector
area: comparative-and-pangenome
---

# An auto-category for synteny tracks in the LGV track selector

(issue
[#4327](https://github.com/GMOD/jbrowse-components/issues/4327)) — answered a
different way, so don't rebuild it as a category. The complaint is real: a
plain LGV's flat list keeps any track whose `assemblyNames` *contains* the
view's assembly, so an `hg38` LGV shows both `hg38-vs-mm10` and `mm10-vs-hg38`
with no signal they are comparative. The issue proposed "query relative" /
"reference relative" auto-categories and a parked counter-proposal argued for
one flat `' Synteny'` bucket instead. What shipped is neither: a **per-row
adornment** naming what the track compares against ("vs mm10"), which the
filter box also matches on, plus a toggle to take the suffix off the row and
out of search (`syntenyAdornment.test.tsx`, `syntenyInLgv.test.ts`,
`HamburgerMenu.tsx`). It answers "is this track relevant to me?" per row,
where a category answers it per group and then has to name an "other
assembly" that all-vs-all and 3-way tracks do not have. The direction-based
split was separately unsound: the adapter convention is `[query, target]` but
the open-custom-track path writes `[target, query]`, so those tracks would be
mislabeled.

**The adornment was then removed too** (2026-08-19), so the issue is open
again and none of the three shapes above is the answer. Two things killed it.
The label repeated the track name: real configs name synteny tracks
`r64_vs_yjm1447_paf`, which made "vs yjm1447" pure duplication on every row —
the config slot and the "Show track annotations" toggle existed only because
that was already obvious when it shipped. Worse, in a dotplot or synteny view
it was *structurally* empty: `filterTracks` lists only tracks covering every
view assembly, so every row compared the same pair and got the same suffix,
and subtracting all the view's assemblies left a genuine cross-species track
with no mate — every row read "vs self". A column that is constant across the
list carries nothing; one that is constant *and wrong* costs. What went with
it: `TrackSelector-trackRowAdornment` (declared in core, never published — it
postdates v4.3.0, so no ABI removal record), `syntenyRowAdornment` in
synteny-core, `hierarchical.trackAdornments`, the toggle, and the adornment's
contribution to the row's search text and tooltip. Anything rebuilt here has
to beat the track name, which usually already says it, and has to say
something that differs between rows of the same list. The one fact a name
cannot carry is that an all-vs-all adapter draws against samples that are not
configured assemblies at all — if that needs saying, say it on the track
itself, not as a per-row suffix.
