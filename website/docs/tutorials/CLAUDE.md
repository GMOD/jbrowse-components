Show rather than tell — informative screenshot specs, minimal prose. No
em-dashes anywhere, including code comments. Numbers, captions and voice are in
`website/CLAUDE.md`; page mechanics in `website/docs/CLAUDE.md`.

A tutorial is **one continuous line of work**. Each step consumes what the step
before it produced, and the test is whether the sections could be reordered
without the page breaking. If they could, it is a user guide wearing a
tutorial's clothes.

One dataset is the usual way to get that, and the safe default. A second is fine
where the first **raised the question it answers**, so the reader arrives at it
rather than being taken there. What the rule excludes is the page that visits
three datasets because each demonstrates the capability once.

The spine can be a task rather than a finding. `display_settings` changes a
setting, reads the name back out of the session, puts that name in a config and
then makes the two disagree; `cli_desktop` builds one folder and opens it twice.
Neither has a dataset in the sense the rest of this file means, and both are
tutorials, because you cannot start at step three.

Every dataset carries a built-in control — something in the same figure that
ought to come out negative — and the page ends by checking the inference against
the raw data.

## Typography

**A gene symbol is `_italic_` in prose and bare everywhere else** — captions,
headings, paper titles, link labels. Backticks are for a string the reader types
into the location box. A protein product is roman where its gene is italic; a
fusion name is one token (`BCR-ABL1`). `mappability_qc` is the page to copy.

Don't pick the emphasis marker; `oxfmt` owns it and writes asterisks only where
the span touches a **non-ASCII** character. Space the operator
(`_ABL1_ × _BCR_`) if you want underscores.

**A menu path in prose spells the label the way the app does**, ellipsis
included: `**Color by... → Modifications**`. Neither `check-menu-paths.ts` nor
`check-menu-labels.ts` sees the ellipsis. In a **caption** the same path stays
bare, because a caption describes the frame rather than telling anyone to click.

## Don't argue, and don't preach

A tutorial cultivates an air of exploring data. Three shapes to cut: the
**thesis paragraph** (a section ending by telling the reader what it all means —
stop at the observation), **anticipate-and-correct** (naming a wrong inference
to refute it), and **moral framing** ("the honest outcome", "checked rather than
trusted").

**Ease the reader in.** Terse is not the goal; unargued is. One sentence of
orientation saying what a step produces, then the mechanics. The TL;DR primes
the page, not each section.

## Commands

These pages are about _using JBrowse_, not bioinformatics scripting, with one
exception: **the command that produces the page's subject file goes in the
prose**, in a form a reader runs on their own equivalent data. Everything around
it stays in `scripts/build_*.sh` under `## Reproduce it end to end`. Link to
`quickstart_web.md` for bgzip/tabix/`text-index` prep.

**The reader has not cloned the repo.** `## Reproduce it end to end` curls the
script and then runs the copy in the working directory;
`scripts/check-build-scripts.py` fails a `bash scripts/…`. The `.py` helpers a
build script invokes are the script's own problem — each fetches what it is
missing, and the same check pins that list against what the script calls.

**Mark the fence `<!-- from: scripts/build_<topic>.sh -->`** and
`check-script-commands` asserts every tool and flag in it still runs in that
script — tools and flags rather than text, since the page carries the general
form and the script the pinned one. Leave the marker off a fence showing a route
the script does not take.

Explain the flags in comments inside the fence, and don't assume the reader
knows why one is there: `seed=42` is not "fixes the run", it is "FLARE draws
random samples while it infers, so two runs differ unless the seed is pinned".
Several short comment lines beat one dense one.

The test is whether a reader with their own data would run the line as written —
anything naming an accession, sample list or locus is script. Filenames are not
the axis.

**A display setting the figure depends on goes in the track config on the page**
too, not only in the script's config patch. Watch for a tool in
`## Prerequisites` that no fence on the page ever invokes.

## Page structure

A tutorial with real requirements opens with `## Prerequisites` under the TL;DR:
a bulleted list, optionally one short paragraph on installing what apt does not
carry. Nothing else. The intro goes under its own `##` heading.

Frontmatter carries `data: hosted | download | pipeline` — what it takes to end
up with what the page shows, **not** whether the figures can be read with
nothing installed. A page whose cost is not about data leaves the field off. An
unknown value fails the build; an absent one is silently no chip.

**A `sidebar_label` leads with the word its kin lead with.** The sidebar is one
flat alphabetical list, so the first word is the only thing grouping it:
`Synteny (MCScan anchors)`, not `MCScan anchors (grape, peach)`. `title` stays
the page's real name; a page needs a `sidebar_label` only when the title does
not already sort where it belongs.

A page closes with `## See also`, then `## References`. Nothing below them.
`## Reproduce it end to end` goes after the data preparation it wraps up.

**A `See also` entry is a bare link and nothing else**, one per bullet, text =
page title. Relaxing this to allow a short qualifier has been tried, and the
qualifiers grew into the sentences the relaxation was meant to exclude.

Don't restate the prerequisite tool list inside Reproduce, point at
`[Prerequisites](#prerequisites)`. Don't write a generic troubleshooting table:
a failure worth documenting is one this dataset produces, and it goes in the
prose where it happens. Don't sell the hosted data — the figures carry live
links.

Moving a figure off a page means moving its card's crop source in
`gen-tutorial-thumbs.ts` too; nothing warns you.

## Existing datasets — read before adding a locus

- `agent-docs/reference/DOG10K_DATASETS.md`
- `agent-docs/reference/SV_MULTIHOP.md` — COLO829/K562 behind `cancer_sv`
- `agent-docs/reference/PANGENOME_GRAPHS.md`
- `agent-docs/ideas/tutorial-ideas-audit.md`, and the dead ends in
  `agent-docs/ideas/cancer-sv-datasets-unshot.md`
