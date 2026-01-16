All documentation is in the website folder `website`, which powers
https://jbrowse.org/jb2/docs/

## For devs

This folder contains scripts to auto-generate some docs

In the root dir run

```
yarn statedocs
yarn configdocs
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

it is not able to document a single variable, so in some places, a dummy
function is put below the `#config/#stateModel` comments

```
function x(){}
```

Only one config/statemodel per file can be used currently

It uses the typescript compiler which spiders over many files when processing a
single file, and it is otherwise hard to keep track of which config/statemodel
is processed unless we keep it to one config/statemodel at a time.

Then, in statemodels

```
#stateModel
#getter
#property - model property
#action
#method - a view that takes function params or is called as a function
```

and in config models

```
#identifier - explicitIdentifier
#baseConfiguration - baseConfiguration
#slot - a config slot
```
