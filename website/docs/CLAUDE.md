# website/docs CLAUDE.md

This site is **Astro** (not Docusaurus). Several docs here are
**auto-generated** — editing the output files directly is pointless (changes are
overwritten on the next regen, and the guide indexes are checked in CI). Edit
the source instead.

## Auto-generated — do not hand-edit

| Path(s)                                                  | Regenerate with              | Source of truth                                                                                  |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `config/*.md` (config schema API)                        | `pnpm autogen` (repo root)   | `configSchema` blocks in plugin/package source (`docs/generateConfigDocs.ts`)                    |
| `models/*.md` (state model API)                          | `pnpm autogen` (repo root)   | MST model definitions in source (`docs/generateStateModelDocs.ts`)                               |
| `api/*.md` (plugin-export API)                           | `pnpm autogen` (repo root)   | `#api <group>` JSDoc tags in source (`docs/generateApiDocs.ts`)                                  |
| color swatch tables between `<!-- COLOR_TABLE … -->`     | `pnpm autogen` (repo root)   | `#color`-tagged color constants in `packages/core/src/ui/theme.ts` (`docs/generateColorDocs.ts`) |
| `user_guide.md`, `config_guide.md`, `developer_guide.md` | `pnpm lint-docs` (repo root) | `website/scripts/generate-guide-indexes.ts` + per-guide frontmatter                              |
| `jbrowse-img.md` (@jbrowse/img static-export tool)       | `pnpm autogen` (repo root)   | `products/jbrowse-img/README.md` (`website/scripts/generate-img-doc.ts`)                         |
| `cli.md` (@jbrowse/cli command reference)                | `pnpm autogen` (repo root)   | `products/jbrowse-cli/README.md` (`website/scripts/generate-cli-doc.ts`)                         |

- `config/`, `models/`, and `api/` are all wiped and rebuilt by a single
  `pnpm autogen` (= `pnpm gendocs` + prettier). Run `autogen`, not `gendocs`
  alone — `gendocs` skips prettier and leaves ~200 files of formatting churn.
  Never hand-edit anything in these three directories.

- **Color swatch tables**: hand-written guides can embed an auto-generated
  swatch table by dropping a marker pair
  (`<!-- COLOR_TABLE alignments-pair-orientation START -->` …`END -->`); the
  block between them is regenerated on every `pnpm autogen` from colors tagged
  at their definition site with a JSDoc
  `#color <group> | <label> | <description>` tag (in `theme.ts`), so colors
  documented in prose never drift from the code. To add a row, tag the color in
  source; to add a table, drop the marker pair. Don't edit between the markers
  (`docs/generateColorDocs.ts` does the rendering).

- **Guide indexes** (`user_guide.md` / `config_guide.md` / `developer_guide.md`)
  are built from each guide's `title`, `description`, and `guide_category`
  frontmatter in `user_guides/`, `config_guides/`, and `developer_guides/`. To
  add a page to an index, give it those frontmatter fields — it appears
  automatically. To change the surrounding prose/headings, edit the generator.
  `pnpm lint-docs-check` runs in CI (`push.yml`) and fails if these three files
  are out of date — so always regenerate, never hand-edit them.
- **`cli.md`**: fully generated from `products/jbrowse-cli/README.md` by
  `website/scripts/generate-cli-doc.ts` (runs in `pnpm autogen`). That README is
  itself generated from the CLI (`products/jbrowse-cli/generate_readme.sh` =
  `preamble.md` + live `jbrowse <command> --help`, run on the package's
  prepack), so the whole page — intro prose included — traces back to the CLI.
  The generator strips the README's frontmatter, adds the website frontmatter,
  rewrites the npm `@jbrowse/img` link to the local `/docs/jbrowse-img` page,
  and runs prettier. Change command flags/descriptions at the CLI source
  (`products/jbrowse-cli/src/commands/`) and the intro at `preamble.md`, then
  regenerate the README — never edit `cli.md`.
- **`jbrowse-img.md`**: fully generated from `products/jbrowse-img/README.md` by
  `website/scripts/generate-img-doc.ts` (runs in `pnpm autogen`). It drops the
  README's H1, adds frontmatter, rewrites repo-relative links to GitHub URLs,
  and runs the result through prettier. It also copies the README's example
  images from `products/jbrowse-img/img/` into `static/img/jbrowse-img/` and
  repoints the `raw.githubusercontent` URLs at those local copies, so the page
  renders without a GitHub-raw dependency (e.g. offline/staging builds), and
  converts the markdown images to `<Figure>` components (the alt text becomes
  the caption). Edit the README, not `jbrowse-img.md`.
- Both README-derived docs are guarded in CI by the "Check README-derived docs
  are up to date" step in `push.yml` (`gen-img-doc --check` +
  `gen-cli-doc --check`), which fails on any drift between a README and its
  generated doc.

Everything else under `docs/` (the quickstarts, `user_guides/*`,
`config_guides/*`, `developer_guides/*`, `tutorials/*`, `faq.md`,
`urlparams.md`, etc.) is hand-written — edit freely.

## Avoiding drift in hand-written docs

The autogenerated pages above are the source of truth; hand-written prose should
point at them, not re-copy their contents (which silently goes stale).

- **Don't restate a config slot's default value.** The `config/*.md` pages
  render each slot's live default (`**Default:** …`) from the schema. Link to
  the slot — `/docs/config/<type>/#slot-<slotname>` (lowercase) — instead of
  writing "(default 0.3)" in prose, which drifts the moment the schema changes.
- **Don't hand-list a docs directory's pages.** Drop a `<!-- doclist:<dir> -->`
  marker (see `remark-doc-list.ts`) and it expands at build time to a
  `[title](url) — description` bullet per page under that dir, from frontmatter —
  the same source the sidebar and landing pages use. `introduction.md` uses
  `<!-- doclist:tutorials -->`. A typo'd dir fails the build.
- **Cross-page anchor links:** write `/docs/page#anchor` (no slash before `#`);
  `rehypeTrailingSlash` adds the trailing slash to the path. CI validates
  fragment targets via `untitaker/hyperlink --check-anchors`.

## Frontmatter

Valid fields: `title` (required), `description`, `draft`, `sidebar_label`, and
`slug` (only `introduction.md` uses `slug: /` to serve at the docs root). Legacy
Docusaurus fields (`id`, `toplevel`, `redirect`) were stripped from hand-written
docs — don't reintroduce them; routing comes from the file path, not
frontmatter. (The generated `config/`/`models/` docs still emit `id:` from their
generators; that's harmless and ignored by the schema.)
