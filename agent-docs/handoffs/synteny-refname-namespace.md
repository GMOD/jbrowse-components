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
holds the rule, the six plugins, the branding results, the **per-site table** (a
row per reader, its two operands, and the symptom on an aliased file) and
**Potential solutions, in the order they can be taken**. The work is in
[TODO.md](../TODO.md) under *Canonicalize the two synteny refName channels* and
*The synteny follow runs away on a swapped-assembly track*. The structural
alternative is [ideas/two-axis-synteny-fetch.md](../ideas/two-axis-synteny-fetch.md).

The four options, one line each, so you know which link to open: canonicalize
both channels (the filed plan, fixes nine straddles and both display-text sites);
brand the out-of-request names afterward so a fourteenth site cannot appear
quietly; a return-direction rename at the RPC layer, which dissolves the class for
all six plugins and is a design pass rather than a patch; or take only the
display-text half, per view, which is independent of the other three and now has a
worked example with a measured cost.

## What is proven, and what is still inferred

**Proven, by a committed fixture.**
`products/jbrowse-web/src/tests/LinearSyntenyRefNameAlias.test.tsx` is two PAFs
describing one alignment, differing only in whether the query contig is spelled
`ctgA` or `A`. Both load and draw — which is the file's first test, and its
premise: an aliased file is not a broken file. The canonical one then lands the
moving row on `ctgA:9500-11500`; the aliased one does not move and raises
`followUnaligned`. The failing case is `test.failing`, so a fix breaks that file
rather than leaving a dead skip.

The 4 seconds in that file is the **aliased** case's bound, not a measurement of
the canonical one — long enough to cover the coarse-blocks debounce and no longer,
because proving a row does *not* move needs a short wait rather than a generous
one. (The separate "completes in four seconds" in the runaway TODO entry is an
observation of the control path, not something this fixture asserts.)

**The audit is now a table, not a count.** It lives in the reference doc, one row
per site with both operands named and the method to re-run it. Thirteen sites,
nine of them straddles; the earlier "eleven" differs only in whether carriers and
producers are counted, which is the reason the table replaced the number.

**Still inferred, and narrowed.**
`LinearDerivativeVsRef/buildDerivativeVsRefSpec.ts` has two different `refName`
uses and only one of them is a refName at all: `derivativeName(candidate)` is a
name this function MINTS for the derivative contig (`der_9_9`), so it belongs to
neither namespace and needs nothing. `seg.refName` is the reference contig a
segment came from, it reaches here from `plugin-alignments`' `computePaths`, and it
is used to build the reference panel's **displayed regions** — which have to be
canonical — as well as to position `FromConfigAdapter` features on them. So it
needs canonicalizing, and it is the one site in the audit that is a *requested*
refName being read rather than an un-requested one, which is why it did not look
like the others.

That classification is **reasoned from the rule, not probed** — weigh it the way
the caution at the bottom of this file asks. The probe that would settle it: a BAM
whose header spells a contig as an assembly alias, then read the reference panel's
`displayedRegions` after building a derivative.

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

## The finding that outranks it

Named here because it is the reason this thread's own bug may not be what to do
next. Turning the follow on over a **swapped-assembly** track (`volvox_del.paf`,
whose rows read `["volvox", "volvox_del"]` while its adapter declares the
assemblies the other way round) pegs a core at 90% with ~1.4 GB resident,
indefinitely — a locked tab, on a track shape `test_data/volvox/config.json` ships
today, where the aliasing bug needs a file no config we ship has.

It is a **lead, not a finding**: the swap is bracketed but the two fixtures differ
in orientation *and* column order, so it is not isolated, and nothing has attributed
the spin. [TODO.md](../TODO.md) §*The synteny follow runs away on a
swapped-assembly track* has what is bracketed and says to profile the hung worker
before touching the follow. Independent of everything else in this file.

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

   One input it did not have before: the dotplot's hover tooltip now does the
   canonical thing, and it cost ~10 lines and no rename — it resolves both axes
   through `pxToBp`, i.e. off the view's own regions, instead of reading the
   fetched name. So the per-view version of this is cheap and needs none of the
   other three options. What that does *not* tell you is whether it is worth doing
   twenty times, which is still the actual question.

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
