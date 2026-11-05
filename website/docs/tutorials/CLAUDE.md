A tutorial shows a reader how to do a task in JBrowse. Cut a section that only
convinces us, the authors, that a result is right.

Put the results in informative figures and keep the prose short. Set an aside
off with commas or parentheses, or give it its own sentence; tutorials and their
code comments use no em-dashes.

## Page scope and order

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

## Voice

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

## Typography

- A gene symbol is `_italic_` in prose and bare in captions, headings, titles
  and link labels; a protein product is roman. `mappability_qc` is the page to
  copy.
- A menu path in prose spells the app's label, with the ellipsis the app shows
  on a row that opens a dialog: `**Color by → Tag...**`. Write the path bare in
  a caption. `Add track` (FAB menu) and `Add track...` (track hamburger) are
  both real labels.

## Commands

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
- **Write `gzip -dc`, not `zcat`**: macOS `zcat` wants a `.Z` and writes an
  empty file. Where a command's speed depends on GNU or BSD tools, say so.
- A display setting the figure depends on goes in the page's track config, not
  only in the script's config patch.

## Page structure

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
- Add a new page to `TUTORIAL_ORDER` in `src/lib/guide-categories.ts`; an
  unlisted one falls to the end.
- A `sidebar_label` leads with the word its kin lead with:
  `Synteny (MCScan anchors)`.
- **A See also entry is a bare link** with no qualifier.
- Describe setup by its steps, and cut a convenience pitch such as "nothing to
  install". A genomes.jbrowse.org link is welcome where the story uses it.
- Move a figure off a page and you move its card's crop source in
  `gen-tutorial-thumbs.ts` too, because no check compares the two.

## Before adding a locus

Read `agent-docs/reference/DOG10K_DATASETS.md`, `SV_MULTIHOP.md`,
`PANGENOME_GRAPHS.md`, `ideas/collections/tutorial-ideas-audit.md` and
`ideas/waiting-on-someone-else/figures-blocked-on-data.md`, which also lists the
removed pages that should not come back as written. `methylation.md`'s SNRPN
figure is the pattern: the methylated haplotype above its unmethylated partner.
