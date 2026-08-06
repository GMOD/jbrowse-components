Show rather than tell — use informative screenshot specs and keep prose minimal.
No numeric values in prose unless programmatically derived. No em-dashes
anywhere, including code comments.

These are about _using JBrowse_, not bioinformatics scripting. Commands that
produce an input file belong in the tutorial's `scripts/build_*.sh` under
`## Reproduce it end to end`. Link to `quickstart_web.md` for bgzip/tabix/
`text-index` prep rather than re-pasting it.

A tutorial with real requirements opens with a `## Prerequisites` section under
the TL;DR: a bulleted list, optionally followed by one short paragraph saying
how to install what apt does not carry. Nothing else. The intro goes under its
own `##` heading, or the TOC files it under "Prerequisites".

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
