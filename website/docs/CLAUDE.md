# website/docs

Astro, not Docusaurus. Frontmatter is `title` (required), `description`,
`draft`, `sidebar_label`, `slug`; routing comes from the file path.

## Generated — never hand-edit

`pnpm autogen` rebuilds `config/`, `models/`, `api/`, the guide indexes
(`user_guide.md` etc.), `cli.md`, `jbrowse-img.md`, and every marker-pair block
(`<!-- COLOR_TABLE … -->`, `FILE_TYPES`, `DISPLAY_TYPES`, `GOTCHA`,
`PROMOTABLE_SLOTS`, `DISPLAY_FOUNDATIONS`, `FETCH_AUTORUNS`, `PALETTE_KEYS`,
`HELPER_PACKAGES`, `REEXPORT_MODULES`). Each renders from a JSDoc tag, a
registration, or a manifest at the definition site — document a new one by
tagging the source. Everything else under `docs/` is hand-written.

The sweep also covers `agent-docs/`, which hosts the `DISPLAY_FOUNDATION_STACKS`
and `FETCH_AUTORUNS` counterparts. A guide table and its architecture-spec twin
come from one scan, so neither is a hand-mirror of the other.

**A table a reader could check against the code is a generator waiting to be
written**, and the strongest tell is a sentence pointing at a file: the
re-export table sat directly under "treat that file as the source of truth" and
was five paths short. Every one of the five above replaced a hand-written table
that had already gone wrong — a foundation nothing composed, a clear condition
that stopped being true, a third of the palette keys missing, four packages
recommended for bundling that pull in `@jbrowse/core`. None of them failed
loudly; each just quietly stopped describing the code.

Where a generator needs prose it can't derive, the tag goes at the definition
site and a missing one is **fatal**, not a blank cell — same reasoning as the
untagged-`#slot` check. A blank cell reads as "this does nothing"; a failed
build reads as "write one line here".

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
