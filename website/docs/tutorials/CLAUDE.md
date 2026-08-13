Show rather than tell — use informative screenshot specs and keep prose minimal.
No em-dashes anywhere, including code comments.

**A gene symbol is `_italic_` in prose and bare everywhere else.** The corpus
already does this; it was just never written down, so nine pages had drifted
into spelling the same gene both ways in the same section. `mappability_qc` is
the page to copy: `_SMN1_` in every paragraph, `SMN1` in every caption. Bare is
right in a caption, a heading, a paper title under `## References`, and a link
label. Backticks are right for a string the reader types into the location box
(``type `TNNT3` into the location box``), which is an input rather than a gene.
Two more cases that look like drift and are not: a protein product is roman
where its gene is italic ("carry no CYP1A2 protein"), and a fusion or hybrid
name is one token rather than two genes (`BCR-ABL1`, `RHD-CE`).

Don't pick the emphasis marker; the formatter owns it. `oxfmt` writes
`_underscores_` almost always, and asterisks only where the span touches a
**non-ASCII** character: `_X_×_Y_` and `_X_→_Y_` come back as `*X*×*Y*` and
`*X*→*Y*`, while `_X_/_Y_`, `_X_-_Y_`, `_X_,_Y_`, `_X_(_Y_)`, `_X_+_Y_` and
`_CDH1_'s` are all left alone. So a possessive or a slashed paralog pair needs
no thought, and the one `*ABL1*×*BCR*` in the corpus is formatter output rather
than drift: an edit to underscores reverts on commit, which is how this was
found. Space the operator (`_ABL1_ × _BCR_`) if you want underscores there.

**A menu path in prose spells the label the way the app does**, ellipsis
included: `**Color by... → Modifications**`, not `**Color by → Modifications**`.
`Group by...`, `Sort by...` and `Show...` were already unanimous on this and
`Color by` was split nine ways to five. `check-menu-paths.ts` polices the `→`
separator and `check-menu-labels.ts` the labels, but the latter normalizes the
ellipsis away, so neither check sees this. In a **caption** the same path stays
bare (`Color by → Reference anchors both bands`), because a caption describes
what is in the frame rather than telling anyone to click; that split is
deliberate, and the four bare ones left in the corpus are three captions and a
link label.

**Few numbers in prose, and none that assert a result.** The test is what the
number is doing. A number that _names_ something is fine and often necessary: a
variant's size (`a 7.8 kb deletion in an intron of NHEJ1`), a coordinate, a bin
size or window the reader types in, a cohort size that comes from the
publication. A number that states an _aspect of the data_ the page could have
shown but instead asserts is the one to cut, because the reader cannot check it
against anything on screen.

**"Programmatically derived" is not an exemption**, and used to read as one: a
page argued its whole result in "83.2% of the reads are at MAPQ 0 against 0.8%",
"4.5x against 30.6x", "18.3% of DGV's call midpoints" — all real, all printed by
its own script, and all telling the story the four lanes beside them were there
to tell. Say which way it went and let the figure carry how far: "most of them
at _SMN1_ and almost none at the control".

A measurement worth keeping goes in a table, which is data presentation rather
than prose, or stays in the script that prints it. Density matters on its own
too: a paragraph with several derived figures in it reads as arithmetic even
when each one is defensible.

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

**A `See also` entry is a bare link and nothing else**, one link per bullet. No
trailing qualifier, no parenthetical, no several links sharing one bullet and
one description. The link text is the page title, which is what a reader picks
from; a comparison worth making is prose, on the page, where it can be read
rather than stumbled on at the bottom. Relaxing this to allow "a short qualifier
naming the relationship" has been tried, and the qualifiers grew into the
sentences the relaxation was meant to exclude.

Don't restate the prerequisite tool list inside Reproduce, point at
`[Prerequisites](#prerequisites)`. Don't write a generic troubleshooting table:
a failure worth documenting is one this dataset actually produces, and it goes
in the prose where it happens.

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
- `agent-docs/ideas/tutorial-ideas-audit.md` — proposed tutorials; the dead-end
  datasets worth not re-checking are in
  `agent-docs/ideas/cancer-sv-datasets-unshot.md`.
