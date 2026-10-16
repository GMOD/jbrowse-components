# examples-site

Shared rules for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).

- **An example file is its engine options, its own controls and nothing else.**
  Mounting, status and chrome come from `@jbrowse/display-ui/embed`. A control
  that is one input bound to one view property stays inline, since it shows the
  reader the API; a kit export earns its place with logic of its own.
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
