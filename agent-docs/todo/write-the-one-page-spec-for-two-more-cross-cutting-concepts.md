---
name: write-the-one-page-spec-for-two-more-cross-cutting-concepts
description: the only part of release validation that asks whether the shape is right rather than whether the tests pin it; the gate's spec is written and the other two concepts were never named
metadata:
  area: release validation, architecture
  category: ready
---

# Write the one-page spec for two more cross-cutting concepts

Mutation sweeps prove the tests pin the code. They say nothing about whether the
shape is right — four gate axes plus a staleness dimension can be perfectly
pinned and still be four axes too many. The one-page spec is the only part of the
release-validation plan that asks that question
([reference/RELEASE_VALIDATION_SAMPLING.md](../reference/RELEASE_VALIDATION_SAMPLING.md)),
and the criterion is built in: **if a concept cannot be stated in a page, that is
the finding.**

**One of three is written.** The region-too-large gate's is
[REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md) § the collapse above the
test list, and the method transfers: enumerate the leaves, group by what a
consumer can tell apart, report both counts. For the gate that was 73 named
intermediate states collapsing to 32 a consumer could distinguish and 7 the
chrome and the fetch autoruns actually read — so the answer is that it is a
four-value verdict with a re-measure flag, and the axes are how it is arrived at
rather than states of their own.

**First move: name the other two.** The plan says "the top three concepts" and
never wrote down which, so picking them is the work before the writing. Rank by
the same thing that put the gate first — a concept whose file count and line
count both grew several-fold since v4.3.0, spread across packages nobody owns
end to end. The gate went 24 → 74 files and 112 → 562 lines; the census half of
`release_sampling_frame.py` is the tool for finding the next two on that measure.
