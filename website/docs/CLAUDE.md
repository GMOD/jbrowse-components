# website/docs

Astro, not Docusaurus. Frontmatter is `title` (required), `description`,
`draft`, `sidebar_label`, `slug`; routing comes from the file path.

## Generated — never hand-edit

`pnpm autogen` rebuilds `config/`, `models/`, `api/`, the guide indexes
(`user_guide.md` etc.), `cli.md`, `jbrowse-img.md`, and every marker-pair block
(`<!-- COLOR_TABLE … -->`, `FILE_TYPES`, `DISPLAY_TYPES`, `GOTCHA`,
`PROMOTABLE_SLOTS`). Each renders from a JSDoc tag or registration at the
definition site — document a new one by tagging the source. Everything else
under `docs/` is hand-written.

## Avoiding drift in hand-written docs

- **Don't restate a config slot's default** — link
  `/docs/config/<type>/#slot-<name>`.
- **Don't hand-list a directory's pages** — use `<!-- doclist:<dir> -->`.
- **Prefer an `include:` marker over a copied code fence**, pointed at compiled
  tested source. `sync-doc-snippets --check` ratchets the count of un-included
  fences under `developer_guides/`, so convert one and lower the baseline.
- **Write `displayDefaults`, not a `displays` array**, unless the example
  selects a non-default display type or needs real `displayId`s.
- **Show a whole track config, not a fragment** — a reader has to be able to
  paste it.
- **Write jexl the short way**: `feature.rank` over `get(feature,'rank')`.
- **`user_guides/` drives the UI, `config_guides/` shows the JSON.** When a
  config guide starts explaining a concept, that section belongs in the user
  guide.
- Cross-page anchors are `/docs/page#anchor` (no slash before `#`).

## Voice: dry and scientific, let the figure do the talking

The figure carries the result; the prose says what was done and what it means.
No drama or stakes, no rhetorical framing of a method, no reveals held for
effect, no conclusion one picture can't support. Applies to captions, gallery
descriptions, and headings too.
