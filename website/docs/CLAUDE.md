# website/docs CLAUDE.md

This site is **Astro** (not Docusaurus). Several docs here are
**auto-generated** — editing the output files directly is pointless (changes are
overwritten on the next regen, and the guide indexes are checked in CI). Edit
the source instead.

## Auto-generated — do not hand-edit

| Path(s)                                                  | Regenerate with              | Source of truth                                                               |
| -------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `config/*.md` (config schema API)                        | `pnpm autogen` (repo root)   | `configSchema` blocks in plugin/package source (`docs/generateConfigDocs.ts`) |
| `models/*.md` (state model API)                          | `pnpm autogen` (repo root)   | MST model definitions in source (`docs/generateStateModelDocs.ts`)            |
| `api/*.md` (plugin-export API)                           | `pnpm autogen` (repo root)   | `#api <group>` JSDoc tags in source (`docs/generateApiDocs.ts`)               |
| color swatch tables between `<!-- COLOR_TABLE … -->`     | `pnpm autogen` (repo root)   | color constants in `theme.ts` + alignments `color.ts` (`docs/generateColorDocs.ts`) |
| `user_guide.md`, `config_guide.md`, `developer_guide.md` | `pnpm lint-docs` (repo root) | `website/scripts/generate-guide-indexes.ts` + per-guide frontmatter           |

- `config/`, `models/`, and `api/` are all wiped and rebuilt by a single
  `pnpm autogen` (= `pnpm gendocs` + prettier). Run `autogen`, not `gendocs`
  alone — `gendocs` skips prettier and leaves ~200 files of formatting churn.
  Never hand-edit anything in these three directories.

- **Color swatch tables**: hand-written guides can embed an auto-generated
  swatch table by dropping a marker pair
  (`<!-- COLOR_TABLE alignments-pair-orientation START -->` …`END -->`); the
  block between them is regenerated on every `pnpm autogen` from colors tagged
  at their definition site with a JSDoc `#color <group> | <label> |
  <description>` tag (in `theme.ts` and the alignments `color.ts`), so colors
  documented in prose never drift from the code. To add a row, tag the color
  in source; to add a table, drop the marker pair. Don't edit between the
  markers (`docs/generateColorDocs.ts` does the rendering).

- **Guide indexes** (`user_guide.md` / `config_guide.md` / `developer_guide.md`)
  are built from each guide's `title`, `description`, and `guide_category`
  frontmatter in `user_guides/`, `config_guides/`, and `developer_guides/`. To
  add a page to an index, give it those frontmatter fields — it appears
  automatically. To change the surrounding prose/headings, edit the generator.
  `pnpm lint-docs-check` runs in CI (`push.yml`) and fails if these three files
  are out of date — so always regenerate, never hand-edit them.
- **`cli.md`**: the `## jbrowse <command>` usage blocks mirror the
  `@jbrowse/cli --help` output. Change flags/descriptions at the CLI source
  (`products/jbrowse-cli/src/commands/`), not here. Only the hand-written intro
  prose at the top is editable in place.

Everything else under `docs/` (the quickstarts, `user_guides/*`,
`config_guides/*`, `developer_guides/*`, `tutorials/*`, `faq.md`,
`urlparams.md`, etc.) is hand-written — edit freely.

## Frontmatter

Valid fields: `title` (required), `description`, `draft`, `sidebar_label`, and
`slug` (only `introduction.md` uses `slug: /` to serve at the docs root). Legacy
Docusaurus fields (`id`, `toplevel`, `redirect`) were stripped from hand-written
docs — don't reintroduce them; routing comes from the file path, not
frontmatter. (The generated `config/`/`models/` docs still emit `id:` from their
generators; that's harmless and ignored by the schema.)
