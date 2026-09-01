All documentation is in the website folder `website`, which powers
https://jbrowse.org/jb2/docs/

## For devs

This folder contains scripts to auto-generate some docs

In the root dir run

```
pnpm autogen
```

This updates website/docs/models, website/docs/config, and website/docs/api
(state models, config, and exported functions), then runs the formatter. The
generators share a single TypeScript program load (the dominant cost — see
`generate.ts`), so they always run together.

This is not part of the build — run it manually and commit the result.

**A `#config` block goes directly above the schema it documents**, not above a
neighbouring `normalizeSnapshot`. The block is extracted with the declaration it
precedes, and anything read off that declaration's source — spread-in slot
tables — is empty otherwise, while the page still renders because slots come
from their own `#slot` tags. Twenty-four schemas were in that state; the
generator throws on it now.

It looks for comments named

```js
/**
 * #stateModel ModelName
 */
```

and

```js
/**
 * #config ConfigName
 */
```

and

```js
/**
 * #api groupName
 * description of the function...
 */
```

The comment can sit directly above a `const`, `function`, or `export default`
declaration. The extractor reads JSDoc that's attached to the declaration via
TypeScript's parser, so make sure there is no blank line between the JSDoc and
the declaration it documents.

Only one `#config`/`#stateModel` per file is supported. The generator runs the
TypeScript compiler (which spiders across many files to resolve a single one),
and keying each documented entity by its filename is what keeps track of which
config/model is being processed — so a second one in the same file would
silently overwrite the first (`assertSingleHeader` in `util.ts` turns that into
a hard error instead).

## Hiding a model with `#internal`

A `#stateModel` block that also carries `#internal` keeps all its in-source
docstrings but gets no website page and no sidebar entry — for app-shell wiring
(`SessionLoader`), desktop job-queue internals, and thin product wrappers whose
documented surface lives on the model they compose.

Do **not** put it on a mixin. A composed page only lists inherited members from
ancestors that resolve to a documented `#stateModel`, so hiding a mixin also
deletes its members from every display/session page that composes it.

Unlike config/statemodel, **many `#api` exports per file** are allowed. Each
`#api` tag documents one exported function or const. The text after the tag is
an optional group/page name; with no name the export's package is used (e.g.
anything in `packages/cigar-utils` → `cigar-utils`). Pass a name
(`#api core/util`) to split a large package across finer-grained pages. The
description on the following lines becomes the doc body; the type signature is
read from the TypeScript checker, so `@param`/`@returns` tags aren't needed.
Output goes to `website/docs/api/<group>.md`, and the same exports are mirrored
into each package's `README.md` between `<!-- API_DOCS_START -->` /
`<!-- API_DOCS_END -->` markers (idempotent; hand-written README prose is left
untouched).

```js
/**
 * #api
 * Returns the JBrowse session model for any node in the state tree.
 */
export function getSession(node) {
  /* ... */
}
```

Then, in statemodels

```
#stateModel
#getter
#property - model property
#volatile - volatile (runtime-only) property
#action
#method - a view that takes function params or is called as a function
```

Each `#stateModel` page is five tables — Properties, Volatiles, Getters,
Methods, Actions — and nothing else. A table lists this model's own members
first, then every member reachable through composition, with a "Defined by"
column linking to the ancestor's page; a member redeclared by a more specific
model appears once, at its most-specific definition. The whole API surface is
therefore on the page, stated exactly once, and a member is one row rather than
a heading plus a code fence.

A row is name-over-type in one cell and the full documentation in the next, so
the prose gets the width. Long types and authored `#example` blocks open in a
modal `<dialog>` from inside their cell (`codeCell`/`exampleCell`/`dialogCell`)
rather than holding the row open — expanding in place reflows the whole table
around a `<pre>` that then has a quarter-width column to live in, where the
dialog gets the width of the window. Each name carries a
`<span id="<tag>-<name>">`, which is what the "Defined by" links on descendant
pages point at. Inherited rows are `data-pagefind-ignore`d, so a search lands on
the model that defines a member instead of on every page that composes it.

Type signatures come from the TypeScript checker, which truncates past ~340
characters by cutting mid-token. `elideSignature` in `util.ts` shortens
over-long types structurally instead, collapsing generic arguments from the
inside out (`IConfigurationReference<ConfigurationSchemaType<…>>`) so what
survives is the outer constructor and the function's own parameter/return shape.

The composition graph is **derived from code**, not authored — the generator
resolves the models passed to the factory's `types.compose(...)` call, and the
base of a `return BaseFactory(args).views(...)` extension chain, through the
TypeScript checker (alias-followed, and following `const X = factory()`
exports), so no `extends`/`composed of` comment needs to be written or kept in
sync. The only requirement is that the `#stateModel` JSDoc sit on the model's
factory (or its `types.compose`), not an unrelated preceding declaration. Any
leftover hand-authored `extends`/`composed of` block is stripped from the
rendered prose so it cannot drift from the derived list.

This mirrors how `#baseConfiguration` derives config inheritance (below).

and in config models

```
#identifier - explicitIdentifier
#baseConfiguration - baseConfiguration
#slot - a config slot
```

The `#baseConfiguration` slot links a config to the one it derives from. The
generator resolves the base config automatically through the TypeScript checker
(following the right-hand-side expression and import aliases), so no name needs
to be written — `createBaseTrackConfig(pluginManager)`,
`baseLinearDisplayConfigSchema`, an aliased default import, and even
`pluginManager.getDisplayType('LinearWiggleDisplay')!.configSchema` (resolved by
the quoted name) all link. Each config page then renders an "Inherited config
slots" section reproducing every base slot in full, so the page is
self-contained; an unresolved base is listed in `coverage-gaps.txt`.

## Adding examples with `#example`

Any `#config`, `#stateModel`, `#slot`, `#getter`, `#action`, `#method`, or
`#api` block can carry one or more `#example` sections. Examples are rendered
prominently at the top of the generated page (before the prose description), so
they are the first thing a reader sees.

Write an `#example` block **after** the rest of the doc text so it stays out of
the prose that `extends` resolution reads:

````js
/**
 * #config BamAdapter
 * used to configure BAM adapter
 *
 * #example
 * The `uri` shorthand auto-resolves the `.bai` index:
 * ```js
 * {
 *   type: 'BamAdapter',
 *   uri: 'https://example.com/sample.bam',
 * }
 * ```
 */
````

The content between `#example` and the end of the JSDoc (or the next `#example`
marker) is rendered verbatim — prose lines explain the snippet, fenced code
blocks are copy-pasteable.

### Multiple labeled examples

Add a label after `#example` to get named subsections. Useful when showing a
minimal form alongside a fully-expanded one:

````js
/**
 * #config CramAdapter
 *
 * #example minimal
 * Minimal — `uri` auto-resolves the `.crai` index:
 * ```js
 * { type: 'CramAdapter', uri: 'https://example.com/sample.cram' }
 * ```
 *
 * #example with-explicit-index
 * Explicit index path for non-standard naming:
 * ```js
 * {
 *   type: 'CramAdapter',
 *   cramLocation: { uri: 'https://example.com/sample.cram' },
 *   craiLocation: { uri: 'https://example.com/sample.crai' },
 * }
 * ```
 */
````

Labeled examples render as `### Example: minimal` /
`### Example: with-explicit-index` subsections nested under `## Example usage`.
Slot- and member-level labeled examples use italic (`_label_`) instead of a
heading to stay subordinate.

### Where `#example` can appear

| Tag                               | Renders at                                      |
| --------------------------------- | ----------------------------------------------- |
| `#config`                         | Top of the config page (`## Example usage`)     |
| `#stateModel`                     | Top of the model page (`## Example usage`)      |
| `#slot`                           | After the slot's code block (`**Example:**`)    |
| `#getter` / `#method` / `#action` | After the member's code block (`**Example:**`)  |
| `#api`                            | After the type signature (`#### Example usage`) |

### Coverage is tracked in `coverage-gaps.txt`

A type with no `#example` gets a page that lists its slots and never shows one
being used, which is the whole point of the page for anyone arriving from a
`#slot-` deep link. A slot with neither a JSDoc body nor an in-object
`description` renders a name and a type over an empty cell. `generate.ts` writes
every such gap to **`coverage-gaps.txt`**, which is committed, so adding one is
a `+ Name` line in the PR diff attributable to the change that caused it, and
filling one in is a `-` line. The `Check config/model/api docs are up to date`
step in `push.yml` diffs it alongside the generated pages, so the list can't go
stale.

The file carries one section per gap kind, each naming the tag that clears it:
missing `#example` (configs, models), blank slot descriptions,
`General`-category fallbacks, members the structural pass can't see, unresolved
`baseConfiguration` references, and adapters whose example defaulted to
`FeatureTrack`. A section stays in the file at `(0)` so a regression is a `+`
line under a heading that was already there.

This replaces relying on `console.warn`: a warning fails nothing and scrolls
past in a CI log, which is how 40 config pages and 90 model pages came to be
bare, and how 101 slots came to render an empty Description cell.

**One gap is fatal instead of tracked.** A slot a `#config` schema declares but
never tags with `#slot` is absent from its page entirely rather than rendered
thinly — the failure mode that hid `configuration.shareURL` when its comment
used `/*` instead of `/**`. The count is zero and the fix is local and
unambiguous, so `generate.ts` throws rather than listing it.

Base/shared schemas (`BaseLinearDisplay`, `SharedVariantDisplay`, ...) are
excluded by design — they are never named in a config, so an example on one
would teach a type nobody can write. They route to their concrete types through
the **Extended by** links instead. See `isBaseSchema` in `generateConfigDocs.ts`
for how one is detected.

## Marker-block generators

Further generators inject tables/catalogs into the **hand-written** guides
(rather than writing whole pages like config/model/api). Each reads a JSDoc tag
at the definition site so the docs can't drift from the code, and rewrites only
the region between a `<!-- MARKER START -->` / `<!-- MARKER END -->` pair — a
guide opts in by dropping that pair, and editing between the markers is
pointless since regen overwrites it.

**The complete list of markers, and which docs render each, is generated**: the
`MARKER_INDEX` table in `agent-docs/ARCHITECTURE.md`. A list here would be the
same enumeration these generators exist to stop hand-maintaining, and was — it
named eight of the thirty-two markers in use, sourced `#color` to the file that
re-exports the colors rather than the one that declares them, and described a
per-generator CLI that had already been replaced by `markers.ts`. Below is how
to write one, not what exists.

A few, as examples of the shapes:

| Tag                                        | Source scanned                                             | Marker                   | Renders                                              |
| ------------------------------------------ | ---------------------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| `#color`                                   | `packages/core/src/ui/palette.ts`                          | `COLOR_TABLE <group>`    | A color-swatch table per group                       |
| `#jexlFunction`                            | every source carrying the tag, core's `util/jexl.ts` first | `JEXL_CATALOG`           | The jexl function catalog, grouped by category       |
| `#extensionPoint`                          | all `plugins`/`packages`/`products`                        | `EXTENSION_POINTS_INDEX` | A completeness index of every extension point        |
| `#displayFoundation` / `…Def`              | `packages`/`plugins`                                       | `DISPLAY_FOUNDATIONS`    | The foundation mixins table, with a "used by" column |
| `#fileFormat`                              | adapter `#config` blocks                                   | `FILE_TYPES <group>`     | Format → adapter → track type routing, per group     |
| `#gotcha`                                  | any `#config` block                                        | `GOTCHA <ConfigName>`    | The type's caution callouts, verbatim                |
| _(none — `new DisplayType` registrations)_ | whole repo                                                 | `DISPLAY_TYPES`          | Track type → display types                           |
| _(none — slots declaring `promotedBase`)_  | config schemas                                             | `PROMOTABLE_SLOTS`       | Which settings can be pinned as a display default    |

**Where a new generator goes decides what gates it.** One that needs nothing
from the TypeScript program joins `MARKER_GENERATORS` in `markerGenerators.ts`
and is verified by `markers.ts --check` (one process for all of them, through
`pnpm autogen`); `generate.ts` calls the same list, so the two cannot disagree
about the set. The five that need the whole-repo program — `DISPLAY_TYPES`,
`DISPLAY_VIEW_TYPES`, `GOTCHA`, `PROMOTABLE_SLOTS`, `SPEC_KEYS` — are called
from `generate.ts` directly and gated by its own `--check` instead.

Either way `assertMarkersAndDocsAgree` holds the two ends together: a marker no
doc renders, and a doc block no generator writes, are both errors. Neither was
before, and both are silent — the second keeps whatever was committed, and the
first reports itself up to date forever.

Tag forms (all pipe-delimited, parsed by `parsePipeTags` in `util.ts`):

```js
/** #color alignments-indicators | Insertion | Reads carry an insertion */
/** #jexlFunction String functions | charAt('abc', 2) | c */
/** #extensionPoint Core-extendSession | sync | Extend the session model */
```

`#color` supports multiple groups per color (one tag each) so a color documents
itself in every legend it appears in. `#extensionPoint` is scanned by regex
across the whole tree (not the TS program), and a point tagged inconsistently in
two places fails the run.

## The remaining tags

These sit in a `#config`/`#stateModel` JSDoc alongside the tags above and change
what the generated page says, so they are listed here rather than left to be
discovered in `parseTaggedComment`. Every one of them is stripped from the
rendered prose, and every one is recognized only when it **heads** its comment
line — a mention inside a sentence is prose, not a tag.

| Tag                     | On                                 | Effect                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#category <word>`      | `#config` / `#stateModel`          | Overrides the name-suffix heuristic that buckets the page in the sidebar (`Adapter`, `Display`, `View`, …). A camelCase word becomes a title-cased label. `*Mixin` model names always bucket under `Mixin` regardless.                                                                                              |
| `#trackType <Type>`     | an adapter's `#config`             | The track type the adapter's `#example` is wrapped in, so the page shows the full config a reader pastes rather than a bare adapter snapshot. Also links the adapter to its track and that track's displays under **Related links**. Defaults to `FeatureTrack`, and is listed in `coverage-gaps.txt` when it does. |
| `#gotcha <text>`        | `#config`                          | A footgun a reader configuring this type has to know but would not infer from the slot list. Renders as a `:::caution` callout directly under the example, and can be pulled into a guide with a `GOTCHA` marker. Runs to the next tag or the next blank line, so it may wrap across lines.                         |
| `#fileFormat`           | an adapter's `#config`             | Opts the adapter into a `FILE_TYPES` table (above).                                                                                                                                                                                                                                                                 |
| `#displayFoundation`    | a display's `#stateModel`          | Opts the display into the `DISPLAY_FOUNDATIONS` table (above) as a user of the named foundation.                                                                                                                                                                                                                    |
| `#displayFoundationDef` | a foundation mixin's `#stateModel` | Declares the foundation and what it brings.                                                                                                                                                                                                                                                                         |
