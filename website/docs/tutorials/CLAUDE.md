Show rather than tell — use informative screenshot specs and keep prose minimal.
No em-dashes anywhere, including code comments.

**No numbers in prose. Not even ones a script in the repo prints.** This rule
used to end "unless programmatically derived", and that clause is what let a
page argue its result in percentages: "83.2% of the reads are at MAPQ 0 against
0.8%", "4.5x against 30.6x", "18.3% of DGV's call midpoints". Every one of those
was emitted by `scan_mappability_qc.sh` and every one was a claim the reader
could not check against the figure it sat under, so the prose was telling the
story the picture is there to tell. Say which way it went and let the lane show
how far ("most of them at _SMN1_ and almost none at the control"). A measurement
worth keeping goes in a table, which is data presentation, or stays in the
script that prints it. The same goes for widths and spans: "a much larger block
containing it" over "about 1.5 Mb", unless the number is one the reader types
into a box.

**Don't argue, and don't preach.** A tutorial cultivates an air of exploring
data; it is not a case being made. Three shapes to watch for, all of which have
had to be cut from these pages:

- **The thesis paragraph.** A section that ends by telling the reader what it
  all means ("The chains are an argument. The reads are the measurement", "This
  is the general habit worth taking from the page"). Stop at the observation.
- **Anticipate-and-correct.** Naming a wrong inference in order to refute it
  ("That is not evidence the DGV records are wrong", "The pile at one end is not
  a defect"). If the wrong reading is likely, prevent it by framing the thing
  positively the first time.
- **Moral framing.** "the honest outcome", "checked rather than trusted", "it
  would be easy to produce that figure dishonestly". State what the setting does
  and let the reader draw the conclusion.

**Ease the reader in.** Terse is not the goal; unargued is. A section that opens
cold on mechanics ("Everything is hosted. The assembly needs a name and the URL
of its sequence") drops the reader into a config with no idea what they are
about to build. One sentence of orientation first, saying what this step
produces and why it is short, then the mechanics. The TL;DR primes the page, not
each section.

These are about _using JBrowse_, not bioinformatics scripting. Commands that
produce an input file belong in the tutorial's `scripts/build_*.sh` under
`## Reproduce it end to end`. Link to `quickstart_web.md` for bgzip/tabix/
`text-index` prep rather than re-pasting it.

A tutorial with real requirements opens with a `## Prerequisites` section under
the TL;DR: a bulleted list, optionally followed by one short paragraph saying
how to install what apt does not carry. Nothing else. The intro goes under its
own `##` heading, or the TOC files it under "Prerequisites".

Frontmatter carries `data: hosted | download | pipeline`, which is the chip on
the page's card: what it takes to end up with what the page shows, **not**
whether the figures can be read with nothing installed. Almost every page
answers yes to the second, so a badge on that axis marks everything and says
nothing; `dog10k_svs` opens with "nothing to read along" and is a bcftools
pipeline, and its card says pipeline. `pipeline` means an analysis tool
(aligner, graph builder, caller), `download` means fetch and index published
files, `hosted` means the data is already served. A page whose cost is not about
data at all (the embedding and display-settings walkthroughs) leaves the field
off rather than picking the nearest of three. An unknown value fails the build;
an absent one is silently no chip, which is why the two must not be confused.

A page closes with `## See also`, then `## References` if it has one. Nothing
goes below them: a worked example parked under `See also` and reached by an
anchor from higher up the page is still content, and belongs above the closing
sections. `## Reproduce it end to end` goes after the data preparation it wraps
up, which on most pages is just before those two.

A `See also` entry may carry a **short qualifier naming the relationship** —
"the same display partitioned by strain", "the germline counterpart" — which is
what lets a reader pick out of a list of ten. It may not carry a sentence
arguing something: a comparison worth making is prose, on the page, where it can
be read rather than stumbled on. (This previously said bare links only, which 21
of 36 tutorials ignored because the qualifier earns its place; the line now says
what the corpus does.) Don't restate the prerequisite tool list inside
Reproduce, point at `[Prerequisites](#prerequisites)`. Don't write a generic
troubleshooting table: a failure worth documenting is one this dataset actually
produces, and it goes in the prose where it happens.

Don't sell the hosted data — the figures already carry their own live links.

A tutorial follows **one dataset** step by step. A page touring a capability
across three datasets is a user guide wearing a tutorial's clothes: refocus it,
or move it to `user_guides/`. Every dataset should carry a built-in control —
something in the same figure, from the same pipeline, that ought to come out
negative — and the page should end by checking the inference against the raw
data. Moving a figure off a page means moving its card's crop source in
`gen-tutorial-thumbs.ts` too; a card whose `src` is no longer on the page still
builds, so nothing warns you.

What the existing datasets are, measured rather than guessed — read before
adding a locus, because these are the facts that produce a plausible wrong
answer if you assume them:

- `agent-docs/reference/DOG10K_DATASETS.md` — which callset carries DUP/INV,
  per-sample copy number from the hosted CRAMs, and why every dog coordinate
  from a paper is canFam3.1 until proven otherwise.
- `agent-docs/reference/SV_MULTIHOP.md` — the COLO829/K562 reconstruction behind
  `cancer_sv`, and four bugs in it that each returned a plausible wrong answer.
- `agent-docs/reference/PANGENOME_GRAPHS.md` — the HPRC/E. coli graphs.
- `agent-docs/OTHER_IDEAS.md` — proposed tutorials, and the dead-end datasets
  worth not re-checking.
