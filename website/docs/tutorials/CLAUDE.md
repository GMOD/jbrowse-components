A tutorial shows a reader how to do a task in JBrowse. A section that only
convinces us, the authors, that a result is right gets cut.

Show rather than tell: informative figures, minimal prose. No em-dashes anywhere
in tutorials, code comments included. Captions, numbers and voice:
`website/CLAUDE.md`; page mechanics: `website/docs/CLAUDE.md`.

The `check-*` scripts under `website/scripts/` (figure-actions,
unshown-settings, unshown-tools, prereq-tools, data-sources, script-commands,
menu-paths, page-endings, tutorial-openings, and `check-build-scripts.py`) hold
most page mechanics and print their rule when they fail; `--list` prints a
ratchet's backlog. What follows is what no check sees.

## Shape

- **A tutorial is one continuous line of work.** Each step consumes what the
  step before produced. If the sections could be reordered without breaking, the
  page is a user guide. The spine can be a task (`display_settings`,
  `cli_desktop`) rather than a dataset.
- **A figure follows an instruction, and an instruction gets a figure**: the
  window to type, the menu path, the config or the command, then the picture of
  its result.
- Most pages spend 150 to 250 lines on preparation before the first figure, on
  purpose. "Put the payoff figure first" is a closed question.
- One dataset is the default. A second belongs only where the first raised the
  question it answers.
- A closing check against the raw data earns its place only as a JBrowse step a
  reader would repeat on their own data, such as opening the reads under a call.
  Cut a script that re-derives the figure's claim from the file.
- `pangenome_ecoli` and `pangenome_cactus` take the same strains through the
  same sections on purpose, so a reader can compare the two graph builders.

## Voice

- Explore the data; don't argue. Cut the thesis paragraph (stop at the
  observation), anticipate-and-correct, and moral framing ("the honest
  outcome").
- One sentence of orientation per step, then the mechanics. The goal is
  unargued, not terse.
- **The opening paragraph reads to someone who has never used JBrowse**: what
  the page looks at and why, in the reader's terms, before any JBrowse noun or
  display class name. The opening names the task and lists the loci.
  `pangenome_hprc_haplotypes` is the page to copy.
- **The opening ends in a list of what we do**, which `check-tutorial-openings`
  holds to a lead-in ending "We:" and three to five bullets. Write each bullet
  as one stage of the page, in page order, opening with a verb. A bullet says
  what JBrowse does (load a file as a track type, color, group, facet, open a
  view); the biology goes in the lead-in. It names a step or a locus, not a
  finding. A sprawling page needs this most.
- Readers skip prose and copy commands, so cut content rather than compress it,
  but never cut a route a reader can run on their own data.
- Say each thing once. Prose beside a figure adds what the caption lacks; prose
  beside a fence adds what its keys and comments lack; a flag's explanation goes
  in the comment in its fence. A sentence naming another tutorial needs a step
  that uses it, or the link goes under See also.

## Typography

- A gene symbol is `_italic_` in prose and bare in captions, headings, titles
  and link labels; a protein product is roman. `mappability_qc` is the page to
  copy. oxfmt picks the emphasis marker.
- A menu path in prose spells the app's label, ellipsis included:
  `**Color by... → Show unmodified in blue**`. A caption keeps the path bare.
- `Add track` (FAB menu) and `Add track...` (track hamburger) are both real
  labels.

## Commands

- **The command that produces the page's subject file goes in the prose**, in a
  form a reader runs on their own data: placeholder filenames, one command per
  fence, one line above it saying what it produces. Anything naming an
  accession, sample list or locus belongs in `scripts/build_*.sh` under
  `## Reproduce it end to end`.
- The reader has not cloned the repo: Reproduce curls the script and runs the
  copy.
- **Never hand over a script bare.** Above the `curl … | bash` fence, a numbered
  list of three or four steps describes what the script does and why, in the
  reader's terms, with no commands.
- `<!-- from: scripts/build_<topic>.sh -->` goes over a fence showing a real
  command the script runs, never over the `curl … | bash` fence, where it
  asserts nothing. Leave it off a fence the script only approximates. A `python`
  or `r` fence takes it too; `dtu` is the example.
- Explain flags in comments inside the fence, including why each is there
  (`seed=42`: FLARE samples randomly, so runs differ unless the seed is pinned).
- **`gzip -dc`, never `zcat`**: macOS `zcat` wants a `.Z` and writes an empty
  file. Where a command's speed depends on GNU or BSD tools, say so.
- A display setting the figure depends on goes in the page's track config, not
  only in the script's config patch.

## Page structure

- `## Prerequisites` comes under the opening paragraph: a bulleted list, then
  the install fence, generated from a
  `<!-- TUTORIAL_INSTALL tool,tool START -->` marker pair out of
  `website/scripts/api-docs/tutorialInstall.json` (apt and conda lines, a Linux
  wget line for binaries apt lacks, plus cargo, pip and npm). A tool with no
  packaged install stays a bullet with a link. The intro gets its own heading.
- **The data section gives the reader instructions.** Its heading is
  `## Download the data` when the reader fetches files by hand, with a `bash`
  fence of `wget -c` lines, one comment per file giving its size, and otherwise
  `## The data`, whose second sentence says whether the reader needs the files:
  "Nothing to download" when the track configs read by URL, "You don't need
  these files to follow the page" when every track reads a hosted result, "run
  [the build script] first, or follow the same commands on your own files" when
  the tracks read local files it writes, and the mixed form when both occur.
  Never "nothing to download by hand", which hides all three. The data is an
  example, so a page that hosts its results also names the step that takes the
  reader's own files. State the cost (size, time, memory) when it passes about 1
  GB or ten minutes, and mark a file the script streams "streamed and never
  downloaded". It lists only what the page's commands or script download, as one
  two-column table: **What it is** (what reads it, in the reader's terms) and
  **File** (a link whose text is the file name). A source read by URL goes in a
  `<details>` summarised "Read by URL (no download needed)"; our own hub configs
  and rehosted results are cut. Past ten rows, split into labelled groups;
  `check-data-sources` holds the shape (two intro paragraphs at most, nothing
  after the last table).
- Our buckets serve no directory listing, so write a rehosted copy as file URLs.
- A Reproduce section does not mean the script fetches the data. Read how the
  script gets each file before writing the sentence.
- A new page goes in `TUTORIAL_ORDER` in `src/lib/guide-categories.ts`.
- A `sidebar_label` leads with the word its kin lead with:
  `Synteny (MCScan anchors)`.
- **A See also entry is a bare link**, with no qualifier and no kind prefix; the
  build adds the prefix.
- No convenience pitches ("nothing to install"). A genomes.jbrowse.org link is
  welcome where the story uses it.
- If you move a figure off a page, move its card's crop source in
  `gen-tutorial-thumbs.ts` too; no check warns you.

## Before adding a locus

Read `agent-docs/reference/DOG10K_DATASETS.md`, `SV_MULTIHOP.md`,
`PANGENOME_GRAPHS.md`, `ideas/collections/tutorial-ideas-audit.md` and
`ideas/waiting-on-someone-else/figures-blocked-on-data.md`, which also lists the
removed pages that should not come back as written. `methylation.md`'s SNRPN
figure is the pattern: the methylated haplotype above its unmethylated partner.
