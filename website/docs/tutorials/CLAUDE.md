Show rather than tell: informative figures, minimal prose. No em-dashes anywhere
in tutorials, code comments included. Captions, numbers and voice:
`website/CLAUDE.md`; page mechanics: `website/docs/CLAUDE.md`.

The `check-*` scripts under `website/scripts/` (figure-actions,
unshown-settings, unshown-tools, prereq-tools, data-sources, script-commands,
menu-paths, page-endings, and `check-build-scripts.py`) hold most page mechanics
and print their rule when they fail; `--list` prints a ratchet's backlog. What
follows is what no check sees.

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
- Every dataset has a built-in negative control in the same figure, and the page
  ends by checking the inference against the raw data.
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
- Readers skip prose and copy commands, so cut content rather than compress it,
  but never cut a route a reader can run on their own data.
- Say each thing once. Prose beside a figure says what the caption cannot; prose
  beside a fence says what its keys and comments cannot; a flag's explanation
  lives in the comment in its fence. A sentence naming another tutorial needs a
  step that uses it, or the link goes under See also.

## Typography

- A gene symbol is `_italic_` in prose and bare in captions, headings, titles
  and link labels; a protein product is roman. `mappability_qc` is the page to
  copy. oxfmt picks the emphasis marker.
- A menu path in prose spells the app's label, ellipsis included:
  `**Color by... → Modifications**`. A caption keeps the path bare.
- **A bold menu path stays on one source line.** oxfmt wraps at 80 columns, and
  the menu-path, figure-action and unshown-setting checks cannot see a split
  path.
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
  list of three or four steps says what the script does and why, in the reader's
  terms, with no commands.
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
- **`## Where the data comes from` lists only what the page's commands or script
  download**, one flat bullet per file ending in the raw URL, under one sentence
  saying who fetches them; the bullet's own label says what reads the file, with
  no per-group paragraphs. A source read by URL goes in a `<details>` summarised
  "Read by URL (no download needed)"; our own hub configs and rehosted results
  are cut. Past ten bullets, split into labelled groups; `check-data-sources`
  holds the shape (two intro paragraphs at most, nothing after the last list).
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
- Moving a figure off a page means moving its card's crop source in
  `gen-tutorial-thumbs.ts`; nothing warns.

## Before adding a locus

Read `agent-docs/reference/DOG10K_DATASETS.md`, `SV_MULTIHOP.md`,
`PANGENOME_GRAPHS.md`, `ideas/collections/tutorial-ideas-audit.md` and
`ideas/waiting-on-someone-else/figures-blocked-on-data.md`, which also lists the
removed pages that should not come back as written. `methylation.md`'s SNRPN
figure is the pattern: the methylated haplotype above its unmethylated partner.
