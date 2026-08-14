---
name: handoff-synteny-refname-namespace
description: Live state of the "synteny compares adapter-space refNames against canonical view state" thread — what is proven by a committed fixture, what is still inferred, the one finding that outranks it, and the three decisions the next person has to make. The knowledge is filed; this is the state.
---

# Handoff: synteny's two refName namespaces

**Started** as a review of the `LinearSyntenyView` follow. Three fixes landed
from that review and the thread then turned into something larger, which is what
this file is about.

Everything durable is filed. Read
[reference/REFNAME_NAMESPACES.md](../reference/REFNAME_NAMESPACES.md) first — it
holds the rule, the audit, the six plugins and the branding results. The work is
in [TODO.md](../TODO.md) under *Canonicalize the two synteny refName channels*
and *The synteny follow runs away on a swapped-assembly track*. The structural
alternative is [ideas/two-axis-synteny-fetch.md](../ideas/two-axis-synteny-fetch.md).

## What is proven, and what is still inferred

**Proven, by a committed fixture.**
`products/jbrowse-web/src/tests/LinearSyntenyRefNameAlias.test.tsx` is two PAFs
describing one alignment, differing only in whether the query contig is spelled
`ctgA` or `A`. Both load and draw. The canonical one follows in 4s; the aliased
one never moves and reports the window unaligned. The failing case is
`test.failing`, so a fix breaks that file rather than leaving a dead skip.

**Still inferred.** The audit found eleven main-thread readers and classified
ten; `LinearDerivativeVsRef/buildDerivativeVsRefSpec.ts` was not finished —
`refName` is used there both as a label and as the derivative contig name, and
which of those needs canonical was not settled. Branding would answer it, which
is one reason to do the branding before believing the site list is complete.

**Audited since, and clean.** The dotplot's own fetch. One main-thread reader of
its adapter-space dictionaries (`nameColorFn`, which hashes a name to a color and
has no canonical operand to disagree with); every other comparison on that path is
adapter-space on both sides deliberately, and its hover tooltip resolves names
through `pxToBp` instead of reading the dictionary at all. Needs no part of this
fix. The reference doc has the enumeration.

**One reader classified differently since.** `syntenyColors.nameColorFunction`'s
`nameOrder` lookup is a straddle, but its symptom is not a missed match — it is
the chromosome-painting palette silently degrading to the hash fallback that
`nameOrder` was added to replace. Also in the reference doc; it matters because a
site whose failure looks like a legitimate state is the kind that survives an
audit.

## The decisions waiting

1. **Fix, or dissolve?** Canonicalizing the two channels makes synteny the sixth
   plugin using a workaround the other five already have. The two-axis fetch
   would remove the class instead. The ideas doc argues these are not
   alternatives — the two-axis change should be justified by the alignments it
   recovers, not by refNames, and would not finish the refName job anyway.
2. **Which first: the runaway or the aliasing?** They are independent. The
   aliasing bug makes a feature quietly do nothing on files no config we ship
   has. The runaway locks a tab on a track shape `test_data/volvox/config.json`
   ships today. That ordering seems clear but it is a product call, and the
   runaway's cause is a lead rather than a finding.
3. **Is the repo-wide display-text case worth opening?** A refName used as
   tooltip or feature-detail text shows the file's spelling in *every* plugin,
   not just synteny. Cosmetic, universally unnoticed, same defect. It is not
   filed as work because nobody has decided it is work.

## One caution about the estimates in here

Four cost estimates were given for this fix across the session and the first
three were wrong — "it touches every main-thread reader" (it touches none),
"building a fixture is the bulk of the work" (the fixture was two lines of PAF,
because `test_data/volvox/config.json` already declared the aliases), and "one
inverse rename at the boundary" (there are two channels, and doing one is worse
than doing neither). Each was corrected only by going and looking. Weight the
fourth accordingly, and prefer the probe to the reasoning — the branding trap
and the TS error codes in the reference doc are there because they were run,
not derived.
