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

You will have to manually do this

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

Only one config/statemodel per file can be used currently

It uses the typescript compiler which spiders over many files when processing a
single file, and it is otherwise hard to keep track of which config/statemodel
is processed unless we keep it to one config/statemodel at a time.

Unlike config/statemodel, **many `#api` exports per file** are allowed. Each
`#api` tag documents one exported function or const. The text after the tag is
an optional group/page name; with no name the export's package is used (e.g.
anything in `packages/cigar-utils` → `cigar-utils`). Pass a name (`#api
core/util`) to split a large package across finer-grained pages. The description
on the following
lines becomes the doc body; the type signature is read from the TypeScript
checker, so `@param`/`@returns` tags aren't needed. Output goes to
`website/docs/api/<group>.md`, and the same exports are mirrored into each
package's `README.md` between `<!-- API_DOCS_START -->` / `<!-- API_DOCS_END -->`
markers (idempotent; hand-written README prose is left untouched).

```js
/**
 * #api
 * Returns the JBrowse session model for any node in the state tree.
 */
export function getSession(node) { /* ... */ }
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

A `#stateModel` JSDoc can declare its composition graph with an `extends` block,
which the generator parses to (a) render a flattened "Inherited members"
overview listing every member reachable through composition, grouped by the
model that defines it, and (b) validate that each link resolves to a generated
page (unresolved links print a warning at generation time):

```
/**
 * #stateModel LinearArcDisplay
 * #category display
 *
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
```

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
