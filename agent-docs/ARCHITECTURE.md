---
name: architecture
description: The map of the code — plugins and the workspace tiers, the MST session tree and where a setting lives, the worker/main-thread split, the grammar of graphics every display's settings speak, and which doc to read next. Read first.
---

# Architecture

JBrowse is a small core plus plugins, held in one mobx-state-tree session. This
doc is the map: what the parts are, the rules that hold across all of them, and
where to read next. Two systems carry most of the code and each has its own
doc. [The grammar of graphics](reference/GRAMMAR_STAGES.md) says what a track
draws, and [the display pipeline](reference/DISPLAY_PIPELINE.md) says how it
fetches and paints. [reference/README.md](reference/README.md) is the generated
index of every reference doc.

## The parts

- **Plugin**: a class whose `install(pluginManager)` registers pluggable
  elements and whose `configure` runs once they are built. The built-in tracks
  and views are plugins too, and a product is a list of plugins plus a shell.
- **Pluggable element**: an adapter, text-search adapter, display, track,
  connection, view, widget, RPC method, internet account or add-track workflow.
  The plugin manager builds them in that order, so a later kind can look up an
  earlier one by name. Extension points are named callbacks the host fires.
- **Session**: the MST root. It holds `views[]`, each view's `tracks[]`, each
  track's `displays[]`, and the session-wide state, `trackConfigDeltas` among
  it.
- **Config**: the JSON that declares an assembly, track or view, read through a
  `ConfigurationSchema`. A track's config names its adapter and its display
  settings.
- **Adapter**: reads one file format in an RPC worker and answers the features,
  or a typed table, for a region.
- **Display**: draws one track in one view. A track can have one display per
  view type.
- **Grammar**: the vocabulary every display's settings speak, which is
  `encoding`, `facet`, `rows`, `filter`, `transform` and `marks`, with one
  object per concept.

## Plugins

The public guides cover the plugin class and every element type:
[pluggable_elements.md](../website/docs/developer_guides/pluggable_elements.md),
[extension_points.md](../website/docs/developer_guides/extension_points.md) and
[simple_plugin.md](../website/docs/developer_guides/simple_plugin.md). Runtime
plugins share the host's singletons (React, MST, `@jbrowse/core`), so every
name the host serves is ABI and a removal fails at the plugin's runtime, not at
the host's build ([reference/PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md),
[ADR-128](architecture-decision-records/adr-128-the-runtime-abi-is-the-exports-maps.md)).
Which list a plugin is installed in decides whether it survives the session:
[reference/PLUGIN_LISTS.md](reference/PLUGIN_LISTS.md).

## Workspace tiers

The three workspace roots are a direction, not three places to put things:

`packages/*` (libraries: core, render-core, the `*-core` domain libraries, the
leaf utils, and the product-assembly libs) → `plugins/*` (+ `example-plugins/*`,
same tier) → `products/*` (web, desktop, cli, the embedded React components,
img, capture).

Dependencies run **down** this list. Three edges cross it upward on purpose, and
each is recorded with its reason in `scripts/workspaceLayering.test.ts`, which
pins them symmetrically — a new upward edge fails, and so does leaving a stale
entry behind after one is removed. The test exists because pnpm links every
workspace package into the root `node_modules`, so an undeclared import of any
of them typechecks and runs.

The load-bearing rule is the one with no exceptions — **no plugin ships a
dependency on a product.** Test-only edges are allowed onto `@jbrowse/web`
alone, which is where `createTestSession` lives.

## The state tree

A view's track is session state that names its config by `trackId`; the config
node a display reads is hydrated from the track's config plus the session's
`trackConfigDeltas`. The MST rules that fail silently are in the root `CLAUDE.md`; the MobX shapes
the code relies on are
[mechanisms/mobx-state-patterns.md](mechanisms/mobx-state-patterns.md) and the
public [mst_patterns.md](../website/docs/developer_guides/mst_patterns.md).

## Where a display's state lives

A new setting has three possible homes, and picking wrong fails silently rather
than loudly. Each has its own JSDoc tag and its own generated doc page:

| home | tag | survives a reload? | read/written as |
| --- | --- | --- | --- |
| config slot | `#slot` | yes — in the track config | `getConf`, written with `setConf` |
| MST property | `#property` | yes — in the session snapshot, on the display node | `self.x`, written by an action |
| MST volatile | `#volatile` | no | `self.x`, written by an action |

**The slot is the default, and by a wide margin.** The census below is
**generated** — a display joins it by constructing its `DisplayType` in its
directory's `index.ts`, and its three numbers are the tags its own directory declares. Read the shape
rather than any one row: on most displays the surviving properties are just
`type` and `configuration`, the structural minimum MST needs.

<!-- BEGIN GENERATED DISPLAY_STATE_CENSUS -->

_Generated by `pnpm autogen` — edit the source, not this block._

17 registered displays declare 369 config slots, 43 MST properties and 65 volatiles between them — counting what each display's own directory declares.

<!-- prettier-ignore -->
| Display | Plugin | `#slot` | `#property` | `#volatile` |
| --- | --- | --- | --- | --- |
| `LinearMarkDisplay` | `plugins/marks` | 81 | 2 | 1 |
| `LinearAlignmentsDisplay` | `plugins/alignments` | 76 | 2 | 11 |
| `LinearMafDisplay` | `plugins/maf` | 38 | 2 | 5 |
| `MultiWaySyntenyDisplay` | `plugins/linear-comparative-view` | 35 | 5 | 19 |
| `LinearBasicDisplay` | `plugins/features` | 34 | 7 | 7 |
| `LinearVariantDisplay` | `plugins/variants` | 32 | 1 | 8 |
| `LDDisplay` | `plugins/variants` | 23 | 2 | 1 |
| `LinearHicDisplay` | `plugins/hic` | 17 | 2 | 1 |
| `ChordVariantDisplay` | `plugins/circular-view` | 9 | 2 | 2 |
| `LGVSyntenyDisplay` | `plugins/linear-comparative-view` | 9 | 2 | 0 |
| `LinearReferenceSequenceDisplay` | `plugins/sequence` | 7 | 2 | 0 |
| `LinearWiggleDisplay` | `plugins/wiggle` | 5 | 2 | 0 |
| `ChordSyntenyDisplay` | `plugins/circular-view` | 1 | 2 | 0 |
| `LinearManhattanDisplay` | `plugins/gwas` | 1 | 3 | 0 |
| `LinearMultiRowFeatureDisplay` | `plugins/marks` | 1 | 2 | 0 |
| `DotplotDisplay` | `plugins/dotplot-view` | 0 | 2 | 5 |
| `LinearSyntenyDisplay` | `plugins/linear-comparative-view` | 0 | 3 | 5 |

<!-- END GENERATED DISPLAY_STATE_CENSUS -->

A slot is not admin-only. A user's edit is diffed into `trackConfigDeltas` — a
frozen `trackId → partial config` map on the session — so a slot is
per-instance *and* persistent without the display model holding it
([ADR-032](architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md),
which is also why the hydrated config node is a detached scratch root and
`getSession()` on it throws). Volatiles are for what genuinely dies with the
view: `BaseDisplay`'s own are `error`, `statusMessage`, `statusProgress`.

**"A display node" means two different things, and they take opposite keys.**
In **config** (`tracks[].displays[]`) the node is built by the display's config
schema, so slots are live and a state-model property is meaningless. In a
**session** (`views[].tracks[].displays[]`) the node is instantiated by the
state model, so properties are live and a slot name is dropped exactly like a
misspelling: `"height": 250` on a session display node silently does nothing.
The JSON Schema's `$defs/<Display>Snapshot` closes the node to its state-model
properties, and `jbrowse validate` reports the slot as one written in the
wrong place (ADR-120).

**Migrating one:** a name an older release used goes in the config schema's
`retired` map, which every door into a display setting reads — a `displays`
entry, the `displayDefaults` shorthand, a share link or agent settings bag, and
the session migration. Its value is what the old name becomes, or a string
naming what replaced a setting that is gone. Rewriting the **value** of a slot
the display still declares is the schema's `preProcessSnapshot`, which the
`displays` union does run while it works out which display an entry is. A
retired display type goes in its successor's `retiredTypes`, and a
display-instance prop an old session carries that is a slot now goes in its
`retiredState`, which `migratedDisplayKeys` reads.

How a slot then reaches the renderer — snapshot, plain object, RPC payload, and
the JEXL callbacks along the way — is
[reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md).

## Worker and main thread

Adapters run in RPC workers and everything else on the main thread. A worker
has no assembly manager, so an assembly name is resolved before the call, and
the reference sequence rides with it as part of the adapter's identity
([reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md#the-reference-is-part-of-the-adapters-identity)).
What crosses back is plain data: features, typed tables or encoded layers in
absolute coordinates.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

**Positions cross the worker boundary cleanly; names do not.** `refName` means
one thing on the main thread and another to an adapter, and which side is
allowed to canonicalize is a rule of its own —
[reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md), summarized
in the root `CLAUDE.md`.

## The grammar of graphics

Every display's appearance settings are the same few objects, spelt as
Vega-Lite spells them
([ADR-238](architecture-decision-records/adr-238-every-display-speaks-vega-lite.md)):

| Object | Says | Read through |
| --- | --- | --- |
| `encoding.color` | unset, a constant `value`, or a `field` through a `scale`, with its `legend` | `colorEncodingOf` (display-kit) |
| `encoding.y` | the plotted value's `field`, its `scale`, `axis` and `rules` | `ScoreScaleMixin` (wiggle-core) |
| `facet` | the `field` that splits features into sections, their `sort` and the `hidden` ones | `FacetWritesMixin`, `groupKeyComparator` |
| `rows` | a row display's row set, order, labels, tree, row colors and row height | `TreeSidebarMixin`, `RowHeightMixin` |
| `filter` | a list of field predicates, compiled to typed compares before the loop | `compilePredicates` (core) |
| `transform`, `marks` | the mark display's steps and layers: what is derived, and which shape draws it | `runTransforms`, `encodeFeatures`, `createMarkBackend` |

**One object per concept, and every surface reads it.** The menus, the legend,
the axis, "Edit plot...", the agent API's `plot`, `jbrowse validate`, a share
link and SVG export all go through the same object, so a display that spells a
concept its own way is the bug. A display keeps its own fetch and layout and
shares these parts; it becomes a mark display only when its whole picture is a
plot. Each display's grammar settings together are its `plot`
([ADR-204](architecture-decision-records/adr-204-every-display-edits-its-grammar-settings-as-one-plot.md)):
`plot` reads them, `applyPlot` writes a draft, and `plotProblems` says what a
draft cannot draw.

The stages, the code that answers each and the decisions that hold each in
place are [reference/GRAMMAR_STAGES.md](reference/GRAMMAR_STAGES.md). Before
proposing a channel, scale kind or transform, read
[reference/GRAMMAR_OF_GRAPHICS.md](reference/GRAMMAR_OF_GRAPHICS.md), which
holds the positions taken and the features declined. Every word and where it
sits is [reference/CONFIG_SPELLINGS.md](reference/CONFIG_SPELLINGS.md).

## Drawing a track

A worker fetches and parses; the main thread uploads the result once and
redraws it every frame through whichever backend the runtime picked, WebGPU,
WebGL2 or Canvas2D. Every canvas display has a Canvas2D draw function, and SVG
export reuses it, so the GPU path is an accelerator over it. A display is
composed from MST mixins: one fetch foundation and whichever cross-cutting
mixins it opts into. The stacks, the fetch autoruns, `rpcProps()` and
`gpuProps()`, readiness, export and their silent-failure rules are
[reference/DISPLAY_PIPELINE.md](reference/DISPLAY_PIPELINE.md); the backends and
shaders are [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md).

## Where to read next

| Task | Read |
| --- | --- |
| Changing what a track draws, or a color, facet, rows or filter setting | [GRAMMAR_STAGES.md](reference/GRAMMAR_STAGES.md), then [GRAMMAR_OF_GRAPHICS.md](reference/GRAMMAR_OF_GRAPHICS.md) |
| Adding a channel, scale, shape or transform step | [MARK_ENCODING.md](reference/MARK_ENCODING.md) |
| Respelling or reviewing a config key | [CONFIG_SPELLINGS.md](reference/CONFIG_SPELLINGS.md), [CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md) |
| Writing or changing a display | [DISPLAY_PIPELINE.md](reference/DISPLAY_PIPELINE.md), [DISPLAY_HOOKS.md](reference/DISPLAY_HOOKS.md), [DISPLAY_KIT.md](reference/DISPLAY_KIT.md) |
| A fetch that loops, refetches or never wakes | [FETCH_KEYS.md](reference/FETCH_KEYS.md) |
| A shader, a backend or context loss | [GPU_RENDERING.md](reference/GPU_RENDERING.md) |
| Opening a view from a spec or URL | [VIEW_INIT.md](reference/VIEW_INIT.md), [SESSION_SPEC_FORMAT.md](reference/SESSION_SPEC_FORMAT.md) |
| Removing or renaming a plugin-facing name | [PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md) |
| Tests and their harnesses | [TEST_INFRASTRUCTURE.md](reference/TEST_INFRASTRUCTURE.md) |
