# examples-site

Shared rules for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).

- **An example file is its engine options, its own controls and nothing else.**
  Mounting, status and chrome come from `@jbrowse/display-ui/embed`. A control
  that is one input bound to one view property stays inline, since it shows the
  reader the API; a kit export earns its place with logic of its own.
- **A page spells out its genome's FASTA.** `jbrowseHub` also fetches the hub's
  track catalog and search index, and `genome-by-name` is the page that shows
  it.
- **Labels beside the tracks stay the page's own** (`track-labels`). A gutter in
  `TrackStack` would need synced row heights or `children` split into in-flow
  headers and overlay layers, and the app's own gutter is parked.
- No comments in example files, bar a one-line pointer at an option a reader
  would not otherwise find.
- **`ultraminimal` imports only what the current npm beta of
  `@jbrowse/display-ui` exports**, because it is the page a reader copies first.
- `EmbedProvider` mounts `Notifications`, so a page owes no error plumbing of
  its own.
- **A block repeating across pages wants a helper in `@jbrowse/display-ui/embed`
  with a jest test**, not a `check-duplication.mjs` list entry. That check sees
  only named top-level declarations, so repeated inline JSX needs a name before
  a green run means anything.
- `pnpm probe-eager-graph` names the modules behind an eager-bundle number. Its
  build overwrites `dist/`, so run `pnpm build` again before trusting a later
  measurement.
