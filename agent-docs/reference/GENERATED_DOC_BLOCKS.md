---
name: generated-doc-blocks
description: The marker pairs that bracket a generated markdown block, which generator writes each one, and the generated index of every block in the tree. Read before hand-editing a table in a doc, or when adding a generator.
audience: internal
---

# Generated doc blocks

Several tables in those guides are **generated**, and so are their counterparts in
`ARCHITECTURE.md` — `pnpm autogen` rewrites both from the same scan, so there is no
mirroring step to forget. **A generated block is bracketed by a marker pair in
one of two spellings** — `<!-- NAME START -->` / `<!-- NAME END -->`, or
`<!-- BEGIN GENERATED NAME -->` / `<!-- END GENERATED NAME -->` — and neither is
hand-editable, here or under `website/docs`. Both spellings are live and the
difference is only which generator wrote the block, so read the marker, not the
form. `pnpm autogen --check` names every block it owns; a block it does not name
is hand-written:

| Marker | Renders | From |
| --- | --- | --- |
| `DISPLAY_FOUNDATIONS` / `DISPLAY_FOUNDATION_STACKS` | which displays compose which foundation ([Display stacks](../ARCHITECTURE.md#display-stacks)) | the `#displayFoundation` / `#displayFoundationDef` tags, plus each foundation's `types.compose(...)` |
| `CROSS_CUTTING_MIXINS` | which displays compose which cross-cutting mixin ([Cross-cutting mixins](../ARCHITECTURE.md#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); the same block renders in `creating_display.md` | the `#crossCuttingMixin` tags, plus every `types.compose(...)` in the tree — no consumer-side tag |
| `FETCH_AUTORUNS` | the fetch-lifecycle autoruns ([Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline)) | the install sites in `MultiRegionDisplayMixin.ts` and their `#autorun` tags |
| `DISPLAY_STATE_CENSUS` | how many slots, properties and volatiles each display declares ([Where a display's state lives](../ARCHITECTURE.md#where-a-displays-state-lives)) | the `#slot` / `#property` / `#volatile` tags in each display directory, the set of directories being those whose `index.ts` calls `pluginManager.addDisplayType` |
| `DISPLAY_HOOK_OVERRIDES` | which display overrides which hook, and what the default does for one that doesn't ([The hooks](../ARCHITECTURE.md#the-hooks-and-who-is-sitting-on-a-default)) | the override sites, scanned and attributed by directory. The hook list and its default text are a curated `HOOKS` array in the generator — no scan can find them — whose `owner` file is asserted to still declare the default |
| `DISPLAY_CHROME_ADOPTION` | which displays render the shared chrome, on screen and on export (in [DISPLAYCHROME.md](DISPLAYCHROME.md), not here) | each LGV display registration: `ReactComponent` for the on-screen column, the state model's `renderSvg` for the export one |
| `PALETTE_KEYS` | the settable theme palette keys | the `Palette` / `StringColors` interfaces |
| `HELPER_PACKAGES` | the standalone npm helper packages | `packages/*/package.json` |
| `REEXPORT_MODULES` | the `@jbrowse/core` subpaths a plugin gets the host's copy of | the `#reexport` comments in `ReExports/list.ts` |

A row joins any of them by existing in the source, never by being written down.
Every one replaced a hand-written table that had already drifted; what each of
them got wrong, and the rule to draw from it, is in
[CLAUDE.md](../CLAUDE.md#frontmatter-and-generated-tables).

The index below is generated too, off the docs' own marker pairs, so a block
whose page nobody wrote down still appears in it. The marker name is what to
grep for in `website/scripts` to find the generator behind a block, and
`website/scripts/api-docs/README.md` is how to write one.

<!-- MARKER_INDEX START -->

<!-- prettier-ignore -->
| Marker | Rendered in |
| --- | --- |
| `ADAPTER_BASES` | `website/docs/developer_guides/creating_adapter.md` |
| `BGZF_POOL_SITES` | `agent-docs/reference/BGZF_WORKER_POOL.md` |
| `COLOR_TABLE` | `website/docs/developer_guides/theming.md`<br />`website/docs/user_guides/alignments_track.md`<br />`website/docs/user_guides/maf_track.md`<br />`website/docs/user_guides/sv_visualization.md` |
| `CROSS_CUTTING_MIXINS` | `agent-docs/ARCHITECTURE.md`<br />`website/docs/developer_guides/creating_display.md` |
| `DISPLAY_FOUNDATION_STACKS` | `agent-docs/ARCHITECTURE.md` |
| `DISPLAY_FOUNDATIONS` | `website/docs/developer_guides/creating_display.md` |
| `DISPLAY_TYPES` | `website/docs/config_guides/tracks.md` |
| `DISPLAY_VIEW_TYPES` | `website/docs/developer_guides/creating_display.md` |
| `ELEMENT_PHASES` | `website/docs/developer_guides/pluggable_elements.md` |
| `EXAMPLE_PLUGIN_TREE` | `website/docs/developer_guides/creating_gpu_display.md`<br />`website/docs/developer_guides/plotting_features.md` |
| `EXTENSION_POINTS_INDEX` | `website/docs/developer_guides/extension_points.md` |
| `FETCH_AUTORUNS` | `agent-docs/ARCHITECTURE.md`<br />`website/docs/developer_guides/data_fetching.md` |
| `FILE_TYPES` | `website/docs/config_guides/file_types.md`<br />`website/docs/config_guides/maf_track.md`<br />`website/docs/config_guides/synteny_track.md` |
| `GATED_BUDGETS` | `agent-docs/reference/REGION_TOO_LARGE.md` |
| `GOTCHA` | `website/docs/config_guides/connections.md`<br />`website/docs/config_guides/customizing_feature_colors.md`<br />`website/docs/config_guides/multiquantitative_track.md`<br />`website/docs/config_guides/synteny_track.md` |
| `GRAPH_PLUGIN_CONFIG` | `website/docs/tutorials/pangenome_cactus.md`<br />`website/docs/tutorials/pangenome_ecoli.md`<br />`website/docs/tutorials/pangenome_hprc.md`<br />`website/docs/user_guides/graph_genome_view.md` |
| `HELPER_PACKAGES` | `website/docs/developer_guides/imports_and_reexports.md` |
| `JEXL_CATALOG` | `website/docs/config_guides/jexl.md` |
| `JEXL_CATEGORY` | `website/docs/config_guides/variant_track.md` |
| `LAUNCH_VIEW_POINTS` | `website/docs/developer_guides/extension_points.md` |
| `MARKER_INDEX` | `agent-docs/reference/GENERATED_DOC_BLOCKS.md` |
| `MENU_ACTIONS` | `website/docs/developer_guides/menus.md` |
| `MENU_ITEM_BUILDERS` | `website/docs/developer_guides/menus.md` |
| `MENU_ITEM_FIELDS` | `website/docs/developer_guides/menus.md` |
| `MENU_ITEM_TYPES` | `website/docs/developer_guides/menus.md` |
| `ORTHOFINDER_CUTS` | `website/docs/tutorials/orthofinder_synteny.md` |
| `ORTHOFINDER_SETS` | `website/docs/tutorials/orthofinder_synteny.md` |
| `PALETTE_KEYS` | `website/docs/developer_guides/theming.md` |
| `PROMOTABLE_SLOTS` | `website/docs/user_guides/display_defaults.md` |
| `REEXPORT_MODULES` | `website/docs/developer_guides/imports_and_reexports.md` |
| `SEARCH_RESULT_FIELDS` | `website/docs/developer_guides/creating_text_search_adapter.md` |
| `SHADER_EXPORTS` | `website/docs/developer_guides/creating_gpu_display.md` |
| `SLOT_TYPES` | `website/docs/developer_guides/configuration_schema.md` |
| `SPEC_KEYS` | `website/docs/urlparams.md` |

<!-- MARKER_INDEX END -->
