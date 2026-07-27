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

Do **not** put it on a mixin. A composed page's "Inherited members" section only
includes ancestors that resolve to a documented `#stateModel`, so hiding a mixin
also deletes its members from every display/session page that composes it.

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

Each `#stateModel` page renders a flattened "Inherited members" section
reproducing every member reachable through composition in full, grouped by the
model that defines it (with a "Derived from" link back to that model's own
page), so the page is self-contained — a reader sees the whole API surface
without chasing links. A member redeclared by a more specific model is shown
once, at its most-specific definition. The "Members" index table at the top
covers the same whole surface — own members first, then each ancestor's — with a
"Defined by" column naming the source (a link to the ancestor's page for
inherited members), so scanning the table finds any member on the page. Both the
table and the inherited section render from one deduped computation, so they
cannot disagree.

Every member is on the page, but they are not all the same size. A member whose
author wrote prose or an `#example` renders as a full entry (heading, prose,
type/code block); the rest — bare setters, internal accessors, the plumbing the
structural pass recovers so the API surface stays complete — compact into a
name-and-type table, since the type is their entire content. Those rows carry an
explicit `<span id>` reproducing the anchor the heading would have had, so the
"Members" index still links to every member. The same split applies inside each
ancestor's "Derived from" block.

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
self-contained; an unresolved base prints a warning at generation time.

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

## Marker-block generators

Three more generators inject tables/catalogs into the **hand-written** guides
(rather than writing whole pages like config/model/api). Each reads a JSDoc tag
at the definition site so the docs can't drift from the code, and rewrites only
the region between a `<!-- MARKER START -->` / `<!-- MARKER END -->` pair — a
guide opts in by dropping that pair, and editing between the markers is
pointless since regen overwrites it. All three run inside `pnpm gendocs`, and
each is also a standalone script with a `--check` mode CI uses to fail when a
tag changed but the docs weren't regenerated.

| Tag               | Source scanned                      | Marker                   | Renders                                        |
| ----------------- | ----------------------------------- | ------------------------ | ---------------------------------------------- |
| `#color`          | `packages/core/src/ui/theme.ts`     | `COLOR_TABLE <group>`    | A color-swatch table per group                 |
| `#jexlFunction`   | `packages/core/src/util/jexl.ts`    | `JEXL_CATALOG`           | The jexl function catalog, grouped by category |
| `#extensionPoint` | all `plugins`/`packages`/`products` | `EXTENSION_POINTS_INDEX` | A completeness index of every extension point  |

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
