---
name: website-writing
description: How do website prose, captions, callouts, cards, hand-written doc pages and tutorials read, and how is a tutorial laid out from its opening to its build script? Read before writing or restructuring any page under website/.
audience: internal
kind: spec
---

# Writing for the website

The house style for everything under `website/`: prose, figure captions and
callouts, cards, hand-written doc pages and tutorials. The `check-*` scripts
under `website/scripts/` (all run by the root `pnpm check-docs`) hold the parts
a grep can see, such as tutorial openings and endings, fence languages, menu
path spelling and caption length; this doc is the rest.

## Prose, captions, cards

- **No numbers that assert a result.** A number that names something (a
  variant's size, a coordinate, a cohort size) is fine; one stating what the
  figure could show goes stale unflagged. Measurements go in a table, the script
  or a spec comment.
- An aside a first-time reader does not need is a footnote (`[^name]`).
- **A caption says what JBrowse is drawing**, in one or two short sentences:
  what is on screen, and at most one mark's reading. Its subjects are tracks,
  lanes, bands and controls; the biology stops at the locus name. Shorten one by
  deleting sentences, not compressing them. Keep specific values out of captions
  and callouts.
- **A callout says what the picture cannot.** Delete one that names the largest
  thing in the frame. Shading where something starts and stops is fine. A short
  callout restating a small chip, track name or legend row in plain words stays
  ("Reads without SA tag" beside the "Not split" chip): app text reaches the
  reader at about 7 px in the docs column.
- **Put something negative in the frame**: a reader cannot see "dense" without
  sparse beside it. Narrowing or widening the window usually supplies one.
- **Say the thing**, not what it isn't ("X rather than Y"), and never argue with
  a previous version of the page.
- A diagram's labels are names; on-image text is a label, never a paragraph.
- **One word per thing**: `color`; a row is a row and a track a track; "lane"
  only in multi-way synteny, whose menu says **Lanes**; prose over a `facet`
  config says facet. Name the object a list belongs to (`rows.sort`,
  `color.domain`).
- Card titles: dataset first, then the pipeline; no numerals, no JBrowse
  vocabulary, about 32 characters.
- Docs address a figure as `/img/...`, never by store URL.

## Videos

- **A video is for a route that ends on a result**; everything else is a figure.
  The route is one a reader would not find alone: a menu path, a dialog, a form.
  The payoff line reads the result off the last frame in the data's terms, never
  the renderer's ("the track re-fits").
- A clip retires no figure; what a clip can shorten is prose.
- Filming a tour: [VIDEO_TOURS.md](VIDEO_TOURS.md).

## Hand-written doc pages

- **A table a reader could check against the code gets a generator**, not a
  hand-written copy ([GENERATED_DOC_BLOCKS.md](GENERATED_DOC_BLOCKS.md)).
- **Link a config slot's default** (`/docs/config/<type>/#slot-<name>`) or a
  value a build script owns through a marker block, rather than restating it.
- List a directory's pages with `<!-- doclist:<dir> -->`, not by hand.
- Quote a number from `agent-docs` through its measurement table or cell, and
  link the doc that owns it.
- In a `json addtrack` fence prefer `displayDefaults` to a `displays` array, and
  the whole-track shorthand (`trackId`, `uri`, `assemblyNames`) where the
  extension infers the adapter.
- **A tagged fence renders app and CLI tabs**, so the prose says what the config
  is, never "add this to `tracks`" or "run the CLI command below". An assembly
  the add-genome form has no input for (`aliases`, `geneticCodes`) gets no app
  tab, and the page gives that reader a sentence in its place.
- `config=` on a session fence adds a live link: prefer
  `config=test_data/<name>/config.json`, relative so `JBROWSE_CODE_BASE`
  retargets it. An addtrack fence takes `loc=` (no spaces) from a locus the page
  already states. **Judge what the session shows**; `check-session-urls` passing
  says only that it opens.
- **Show what a command prints in a `text output` fence directly under it**,
  pasted from a real run; the site renders it in the command's box. Put a file
  the command writes in a plain `text` fence.
- Write jexl the short way: `feature.rank`, not `get(feature,'rank')`.
- `user_guides/` drives the UI; `config_guides/` shows the JSON.

### Voice

Write dry, scientific prose: the figure shows the result, and the prose
describes what was done and what it means. A page opens with a plain paragraph,
under no summary label, saying what it shows and what makes it work, without
"this page". Open on something the title does not say, end on the last fact, and
credit the result to the mechanism that produced it.

## Tutorials

A tutorial shows a reader how to do a task in JBrowse. Cut a section that only
convinces us, the authors, that a result is right. Put the results in
informative figures and keep the prose short. Set an aside off with commas or
parentheses, or give it its own sentence; tutorials and their code comments use
no em-dashes.

### Page scope and order

- **A tutorial is one continuous line of work.** Each step consumes what the
  step before produced; if the sections could be reordered without breaking, the
  page is a user guide. The line of work can follow a task (`display_settings`,
  `cli_desktop`) as well as a dataset.
- Keep the preparation before the first figure (150 to 250 lines on most pages);
  payoff-first was declined.
- Use one dataset by default, and add a second only where the first raised the
  question the second answers.
- A closing check against the raw data stays only as a JBrowse step a reader
  would repeat on their own data, such as opening the reads under a call. Cut a
  script that re-derives the figure's claim from the file.
- `pangenome_ecoli` and `pangenome_cactus` take the same strains through the
  same sections on purpose, so a reader can compare the two graph builders.

### Voice

- Describe what the data shows and stop at the observation. Cut a thesis
  paragraph, a sentence that answers an objection the reader never raised, and
  moral framing ("the honest outcome").
- Open each step with one full sentence of orientation that states its goal
  without arguing for it, then give the mechanics.
- **The opening paragraph reads to someone who has never used JBrowse**: what
  the page looks at and why, in the reader's terms, before any JBrowse noun or
  display class name. It names the task and lists the loci.
  `pangenome_hprc_haplotypes` is the page to copy.
- The opening's lead-in ends "We:"; each bullet is one stage of the page, in
  page order, opening with a verb that says what JBrowse does (load a file as a
  track type, color, group, facet, open a view). The biology goes in the
  lead-in; a bullet names a step or a locus, not a finding.
- Readers skip prose and copy commands, so cut content rather than compress it,
  but keep every route a reader can run on their own data.
- Say each thing once. Prose beside a figure adds what the caption lacks; prose
  beside a fence adds what its keys and comments lack; a flag's explanation goes
  in the comment in its fence. A sentence naming another tutorial needs a step
  that uses it, or the link goes under See also.

### Typography

- A gene symbol is `_italic_` in prose and bare in captions, headings, titles
  and link labels; a protein product is roman. `mappability_qc` is the page to
  copy.
- A menu path in prose spells the app's label, with the ellipsis the app shows
  on a row that opens a dialog: `**Color by → Tag...**`. Write the path bare in
  a caption. `Add track` (FAB menu) and `Add track...` (the track selector's
  menu) are both real labels.

### Commands

- **The command that produces the page's subject file goes in the prose**, in a
  form a reader runs on their own data: placeholder filenames, one command per
  fence, one line above it saying what it produces. Anything naming an
  accession, sample list or locus belongs in `scripts/build_*.sh` under
  `## Reproduce it end to end`, which curls the script and runs the copy (the
  reader has not cloned the repo).
- **Above the `curl … | bash` fence, a numbered list** of three or four steps
  says what the script does and why, in the reader's terms, with no commands.
- Put `<!-- from: scripts/build_<topic>.sh -->` over a fence showing a real
  command the script runs (`python` and `r` fences too; `dtu` is the example).
  Leave it off the `curl … | bash` fence and off a fence the script only
  approximates.
- Explain flags in comments inside the fence, including why each is there
  (`seed=42`: FLARE samples randomly, so runs differ unless the seed is pinned).
- Where a command's speed depends on GNU or BSD tools, say so.
- A display setting the figure depends on goes in the page's track config, not
  only in the script's config patch.

### Page structure

- `## Prerequisites` comes under the opening paragraph: a bulleted list, then
  the install fence from a `<!-- BEGIN GENERATED TUTORIAL_INSTALL tool,tool -->`
  marker pair (`website/scripts/api-docs/tutorialInstall.json`). A tool with no
  packaged install stays a bullet with a link. The intro gets its own heading.
- **The data section gives the reader instructions.** Head it
  `## Download the data` when the reader fetches files by hand (a `bash` fence
  of `wget -c` lines, one comment per file giving its size), otherwise
  `## The data`, whose second sentence says whether the reader needs the files:
  "Nothing to download" when the track configs read by URL, "You don't need
  these files to follow the page" when every track reads a hosted result, "run
  [the build script] first, or follow the same commands on your own files" when
  the tracks read local files it writes, and the mixed form when both occur. A
  page that hosts its results also names the step that takes the reader's own
  files. State the cost (size, time, memory) past about 1 GB or ten minutes, and
  mark a file the script streams "streamed and never downloaded".
- The data table lists only what the page's commands or script download, in two
  columns: **What it is** (what reads it, in the reader's terms) and **File** (a
  link whose text is the file name). A source read by URL goes in a `<details>`
  summarised "Read by URL (no download needed)"; cut our own hub configs and
  rehosted results.
- Our buckets serve no directory listing, so write a rehosted copy as file URLs.
- Read how the script gets each file before writing that the data is fetched: a
  Reproduce section does not mean the script fetches it.
- A `sidebar_label` leads with the word its kin lead with:
  `Synteny (MCScan anchors)`.
- **A See also entry is a bare link** with no qualifier.
- Describe setup by its steps, and cut a convenience pitch such as "nothing to
  install".
- **Link a genomes.jbrowse.org page where the page loads data from it**, saying
  what it loads. A page building its assembly from FASTA links none until it
  loads the hub; a staging.genomes.jbrowse.org link stands until v5 ships, and
  the page says so.
  - Take the assembly and gene track verbatim from the hub:
    `scripts/hosted_assembly.py` for a build script, its absolutized output
    for a page's fence (`ld_mosquitoes.md`).
  - A GenArk hub's `refNameColumnHeaderName: "ucsc"` makes UCSC names
    canonical, so a spec's `displayedRegionNames` says `chr12`, not the NCBI
    name.

### Before adding a locus

Read [DOG10K_DATASETS.md](DOG10K_DATASETS.md), [SV_MULTIHOP.md](SV_MULTIHOP.md),
[PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md),
`ideas/collections/tutorial-ideas-audit.md` and
`ideas/waiting-on-someone-else/figures-blocked-on-data.md`, which also lists the
removed pages that should not come back as written. `methylation.md`'s SNRPN
figure is the pattern: the methylated haplotype above its unmethylated partner.
