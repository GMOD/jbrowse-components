---
id: 03_adding_pluggable_element
title: Adding your own pluggable element
toplevel: true
---

import Figure from '../../../figure'

<!-- CAROLINE: TODO -->

Now that our environment is set up and running, we're going to add our own pluggable element to the project and observe it running in JBrowse.

For this tutorial, we're going to be writing and adding a new [display type](/) to the linear genome view.

## Add new files, stubs, and install dependencies

Right now, your project structure will look something like this:

```

```

We're going to add a few files:

A new folder within src called "

## Install the plugin to JBrowse at runtime

## A display's `index.js`

## A display's `configSchema.js`

Learn more about the configSchema.

## A display's `model.js`

Learn more about mobx-state-tree.

## Setup the configuration for proper testing

For the purposes of this tutorial, we're going to need to add an assembly and some data to our JBrowse session.

> add hg38

> some kinda vcf

```
{
  "assemblies": [],

}
```

          displays: [
            {
              type: 'ChordVariantDisplay',
              displayId: `sv-inspector-variant-track-chord-display-${self.id}`,
              onChordClick: `jexl:defaultOnChordClick(feature, track, pluginManager)`,
              renderer: { type: 'StructuralVariantChordRenderer' },
            },
          ],

## Testing it out

## Writing a simple regression test with cypress

## Next steps

We have a complete and tested plugin, so now we're ready to publish it to NPM and request that it be added to the plugin store.
