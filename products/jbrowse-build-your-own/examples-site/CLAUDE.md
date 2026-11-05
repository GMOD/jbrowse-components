# examples-site

Shared rules for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).

- **An example file is its engine options, its own controls and nothing else.**
  Mounting, status and chrome come from `@jbrowse/display-ui/embed`. A control
  that is one input bound to one view property stays inline, since it shows the
  reader the API; a kit export earns its place with logic of its own.
- **Spell out the genome's FASTA on a page.** `jbrowseHub` also fetches the
  hub's track catalog and search index, and `genome-by-name` is the page that
  shows it.
- **Keep labels beside the tracks the page's own** (`track-labels`); a gutter in
  `TrackStack` is parked.
- Write no comments in example files, bar a one-line pointer at an option a
  reader would not otherwise find.
- **Import in `ultraminimal` only what the current npm beta of
  `@jbrowse/display-ui` exports** — it is the page a reader copies first.
- **Move a block repeating across pages into a helper in
  `@jbrowse/display-ui/embed` with a jest test.** `check-duplication.mjs` sees
  only named top-level declarations, so name repeated inline JSX before a green
  run means anything.
