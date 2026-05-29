All documentation is in the website folder `website`, which powers
https://jbrowse.org/jb2/docs/

## For devs

This folder contains scripts to auto-generate some docs

In the root dir run

```
pnpm statedocs
pnpm configdocs
```

To update statemodels and config individually

These will update website/docs/models and website/docs/config respectively

You will have to manually do This

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
