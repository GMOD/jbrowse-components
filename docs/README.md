All documentation is in the website folder `website`, which powers
https://jbrowse.org/jb2/docs/

## For devs

This folder contains scripts to auto-generate some docs

In the root dir run

```
pnpm autogen
```

This updates both website/docs/models and website/docs/config (state models and
config), then runs the formatter. The two generators share a single TypeScript
program load (the dominant cost — see `generate.ts`), so they always run
together.

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

The comment can sit directly above a `const`, `function`, or `export default`
declaration. The extractor reads JSDoc that's attached to the declaration via
TypeScript's parser, so make sure there is no blank line between the JSDoc and
the declaration it documents.

Only one config/statemodel per file can be used currently

It uses the typescript compiler which spiders over many files when processing a
single file, and it is otherwise hard to keep track of which config/statemodel
is processed unless we keep it to one config/statemodel at a time.

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
