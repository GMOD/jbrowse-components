---
name: generated-claims
description: A doc's claims about the code are rendered from the code, and the ones that cannot be are checked instead — the marker-pair mechanic, the one-value-one-home chain behind a published number, self-declaring scope, and the ratchet that lets a convention start with debt. Read before hand-writing a table, a count or a figure into any doc, or when deciding whether a claim wants a generator or a checker.
---

# A claim about the code is generated from the code

Prose rots in one direction. The code moves, the sentence about it does not, and
nothing in the world reports the difference — the doc still parses, still reads
well, and is now wrong in a way that costs the next reader a session. This repo
answers that structurally rather than by diligence, and the answer is three
moves, in this order:

- **Derive the claim from its subject** where the claim is mechanical.
- **Check the half that rots** where it is not, and leave the editorial half
  alone.
- **Ratchet** where today's answer is "most of them are still hand-written."

The local spellings are in [agent-docs/CLAUDE.md](../CLAUDE.md); the checkers
are `scripts/autogen.ts` and the `website/scripts/check-*.ts` and
`website/scripts/*sync*.ts` families. What follows is the shape, which has
nothing to do with genomics.

## The rule, and the two sentences that trigger it

**If a sentence tells the reader to go look at a file, generate the table under
it from that file.** That is the whole rule, and its two corollaries are where
it actually bites:

- **A number a reader could recount is a table.** `ARCHITECTURE.md` argued that
  a config slot is a display's default state home using three pairs of counts
  typed into the prose. They were right the day they were written: alignments
  went 45 → 47 → 48 → 46 while the sentence still said 45.
  `check-doc-imports.ts` resolves the identifiers a doc names and never the
  counts it states about them, so nothing could have caught it. It is
  `generate-display-state-census.ts` now.
- **A list someone transcribed once is an index.** `ideas/`'s hand-maintained
  104-line index was the same shape one level up — rows restating headings that
  nobody re-derived — and generating it was as much the point of exploding
  `OTHER_IDEAS.md` into one file per proposal as the split itself was.

## The mechanic is a marker pair and one shared helper

A generated region is bracketed in the doc:

```
<!-- BEGIN GENERATED REFERENCE INDEX -->
…generated…
<!-- END GENERATED REFERENCE INDEX -->
```

`spliceGeneratedBlock` in `website/scripts/check-utils.ts` owns that splice and
`checkOrWrite` owns the `--check`/write dance, so a new generator is a query
plus a table and never its own file-rewriting logic. Three properties of that
pair are load-bearing and each was paid for:

- **The prose around the block stays hand-written.** A doc is not a generated
  artifact; one region of it is. That is what makes the convention adoptable one
  claim at a time instead of by rewriting a page.
- **Authoring mistakes throw rather than render.** An `END` above its `BEGIN`
  splices the table into the middle of the prose and silently deletes what sat
  between them; a second marker pair is simply never regenerated while `--check`
  agrees the file is current. Both produce a plausible file, so both are errors.
- **Every artifact is judged before anything exits**, so one run names all of
  them (`checkOrWriteAll`). Exiting on the first stale file turns "regenerate
  and commit" into fix, push, discover the next one — and it was live: three
  guide indexes generate in one loop, so a stale `user_guide.md` hid a stale
  `developer_guide.md` behind it.

**One entry point over all of them.** `pnpm autogen` runs every generator and
`--check` verifies every one, which gives any "X is out of date" failure a
single answer. CI used to list each as its own step, so a run reported only the
first stale artifact.

## One value, one home, and every copy rendered

A published number is the hard case, because it legitimately appears in more
than one place: the record, the internal doc that owns it, and the public page
that digests it. Three copies is two chances to be the stale one, and it was —
the same figure sat at a pre-migration value in the manuscript while the library
it measured had moved on.

So the value has exactly one home and every appearance is rendered from it:

```
agent-docs/measurements/<id>.json     the record — values, date, how to re-take
  │  generate-measurement-tables
  ▼
agent-docs/…/DOC.md                   the doc that owns the measurement
  │  sync-measurements
  ▼
website/docs/…/page.md                the public copy
```

Both ends carry the same marker pair, so there is one spelling to know, and both
directions are errors: a block naming no record, and a record no doc publishes.

Two decisions inside that are worth stealing whole. **A column that is
arithmetic over other columns is declared as derived**, not typed —
re-measuring one arm then moves the ratio beside it, which is what a typed-out
speedup cannot do. And **the table travels whole**, no row or column filter:
a projection is an editorial decision taken once and thereafter invisible, so
the next person to add a row has no way to know the public copy shows a subset.
Where a table reads badly in public, the fix is the record.

**A figure quoted in prose carries a reference rather than a retyped value** —
`1.34-1.46x<!--m:bgzf-pool-tabix.speedup.range-->` resolves against the record's
own column. Prose restating a figure from the table above it is the one
staleness no checker can see, because the old value is still sitting in the doc
it was copied from.

## Scope declares itself

Every one of these needs a membership rule, and the rule is always "be the
thing", never "join a list someone maintains":

- A page is a measurement page **because it carries a measurement block**. A new
  one joins by doing the thing that makes it a measurement page.
- A display joins the census **because its `index.ts` calls
  `pluginManager.addDisplayType`** — the registration itself rather than a name
  pattern, so a retired display leaves by not being registered.
- A doc joins its directory index **because it carries the frontmatter every doc
  there already needs**, and a doc without it is an error rather than an absence.

A registry maintained beside the thing is one more copy to go stale, which is
the failure this whole page is about.

## What cannot be generated is checked, and only the half that rots

`check-quoted-figures.ts` pulls every `<number><unit>` out of a measurement page
and requires that figure to appear in something the page **cites** — an internal
doc it links, or the JSDoc of a symbol it names. That is a much weaker claim than "this number is right", and it is the
strongest one available cheaply, because it catches the two failures that
actually happen: a figure fat-fingered on the way in, and a figure left behind
when its source moved.

**An editorial column is not by itself a reason to hand-maintain a table** —
ask where the judgement lives before concluding the table cannot be generated.
`TODO.md`'s index carried two columns no generator could invent, the area and
the first move on work nobody has started, so it was written by hand and
`check-todo-index.ts` guarded the half that rots. It drifted twice anyway. Those
two judgements moved into each entry's own frontmatter, beside the `category` it
already carried, and the whole table became derivable: `generate-todo-index.ts`
renders it, the counts sentence in the preamble with it, and the checker is
gone. A generator cannot invent a judgement, but it can read one an entry
carries.

**The scoping is the whole trick, and it is worth measuring rather than
asserting.** Searching all of source instead of what the page cites admitted 73
of 101 integer percentages, which is most typos — an existence check over a
large enough haystack is a check that cannot fail.

## A ratchet is how a convention starts with debt

Most conventions here arrive after the docs they govern. A bare error then means
"fix every violation now or stay red", which is how a rule gets marked exempt to
get green — the one move that puts it back where it started.

So the count is a baseline that may fall and may not rise:
`sync-doc-snippets.ts` counts hand-written code fences that could be included
from real compiled source, `check-reference-citations.ts` counts docs no page
links, and each fails only when the total goes up. Lowering the number is one
deliberate edit, and both scripts print the new floor to lower it to when it has
moved. `check-reference-citations` reached zero in two passes and is kept as a
ratchet anyway.

Its companion is the **self-declared kind**: an uncited internal doc and an
uncited public-facing one look identical from outside, so the doc says which it
is (`audience: internal`) rather than the check inferring it from an absence.
The published-benchmark doc is what the absence cost — the only whole-app
measurement against a released version, cited by no page, while the page
digesting it opened by saying everything on it was measured.

## Where this fails, stated plainly

- **An existence check passes on a coincidence.** Two figures that collide are
  indistinguishable, and the defence is scope, not cleverness.
- **A checker that reads a pattern can silently match half of it.** The range
  check matched only the upper end of `70-90%` for as long as its own comment
  claimed both, so re-measuring the lower bound was invisible. It is pinned by a
  test now. This class —
  [green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) — is the one
  to sabotage every generator against: change the source, confirm the check goes
  red, never read it and agree with it.
- **Attribution shortcuts are real.** The state census counts what a display's
  own directory declares, because the alternative is walking the compose graph;
  slots contributed by a shared fields file are in nobody's row. A generated
  number is exact about a question that is itself an approximation, and the
  generator's header is where that is admitted.
- **This doc is subject to its own rule.** It names no count of generators,
  markers or docs, because a count belongs in a table nobody has to retype.
