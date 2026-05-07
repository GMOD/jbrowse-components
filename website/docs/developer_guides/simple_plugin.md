---
id: simple_plugin
title: Writing a plugin using jbrowse-plugin-template
toplevel: true
---

import Figure from '../figure'

Plugins add new pluggable elements (views, tracks, adapters, etc.) and can
modify application behavior by watching state. See the
[pluggable elements](/docs/developer_guides/pluggable_elements) page for the
full list of element types.

This tutorial walks through setting up a plugin and running a local JBrowse
instance with it.

## Prerequisites

- git
- A stable and recent version of [node](https://nodejs.org/en/)
- yarn or npm
- basic familiarity with the command line, React, package management, and npm

First we're going to install and set up the project for development.

## Choose a plugin template

Two official templates are available:

| Template | Bundler | Package manager | Testing |
|---|---|---|---|
| [jbrowse-plugin-template](https://github.com/GMOD/jbrowse-plugin-template) | rollup | yarn/npm | Jest |
| [jbrowse-plugin-esbuild-template](https://github.com/GMOD/jbrowse-plugin-esbuild-template) | esbuild | pnpm | vitest + Puppeteer E2E |

The esbuild template has faster builds and includes end-to-end tests against
JBrowse nightly builds. The rollup template is older and more widely referenced
in existing examples. This tutorial uses the rollup template; the esbuild
template follows the same plugin structure.

Clone the rollup template:

```bash
# change jbrowse-plugin-my-project to whatever you wish
git clone https://github.com/GMOD/jbrowse-plugin-template.git jbrowse-plugin-my-project
cd jbrowse-plugin-my-project
```

## Initialize the project

Run:

```bash
yarn init
```

You'll be asked a few questions relating to your new project.

Most fields can be left blank, but **make sure to enter a descriptive name for
your plugin** in the first field.

:::note Tip

A typical naming convention for JBrowse plugins is **"jbrowse-plugin-"**, or, if
you are going to publish to an NPM organization, we advise
**"@myscope/jbrowse-plugin-"**.

:::

You also need to install the dependencies:

```bash
yarn # or npm i
```

## Setup JBrowse 2

Run:

```bash
yarn setup
```

which will grab the latest release version of JBrowse 2 (in the `.jbrowse`
directory) and make it easy for you to run within your plugin project.

To run JBrowse:

```bash
yarn browse
```

You should see something like the following:

```bash
yarn run v1.22.10
$ npm-run-all jbrowse:*
$ shx cp jbrowse_config.json .jbrowse/config.json
$ cross-var serve --listen $npm_package_config_browse_port .jbrowse
```

We still need to run the plugin though; we need **both to be running** to test
our plugin.

In a new terminal tab, start the plugin:

```bash
cd jbrowse-plugin-my-project
yarn start
```

Now you can navigate to [http://localhost:8999/](http://localhost:8999/), and
see your running JBrowse instance!

<Figure caption="Your browser should look something like the above screenshot." src="/img/plugin_template_spin_up_start.png"/>

:::info

At this point, you _must_ be running your plugin on port `9000` to see a running
JBrowse instance, otherwise you will meet a screen asking you to configure your
instance.

If you'd like to change this port, you can edit the "port" fields under "config"
in the `package.json` file.

:::

We can verify our plugin has been added to our JBrowse session by clicking the
first square on the splash screen "Empty," and then navigating `Add` ->
`Hello View` in the menu bar. This is the example pluggable element that is
added in the template plugin project.

For this tutorial, we're going to be creating a custom
[widget](/docs/developer_guides/creating_widget), and using a
[Jexl](https://github.com/TomFrost/Jexl) callback to open it when we click a
chord on the circular genome view.

<Figure src="/img/plugin-dev-tutorial-final.png" caption="A screenshot of the finished product of this tutorial: a widget with a jexl callback on the circular view." />

## Add new files, stubs, and install dependencies

Add a new directory under `src` called `CircularViewChordWidget` with two files
`CircularViewChordWidget.tsx`, and `index.tsx`.

This component is essentially just a React component we're going to embed in a
JBrowse widget.

### A widget's `index.tsx`

The index file is going to export what our `pluginManager` needs to recognize
the widget: a `ReactComponent`, a `configSchema`, and a `stateModelFactory`.

`CircularViewChordWidget/index.tsx`

```ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

export { default as ReactComponent } from './CircularViewChordWidget'
export const configSchema = ConfigurationSchema('CircularViewChordWidget', {})

export function stateModelFactory(pluginManager: PluginManager) {
  const stateModel = types
    .model('CircularViewChordWidget', {
      id: ElementId,
      type: types.literal('CircularViewChordWidget'),
      featureData: types.frozen({}),
    })
    .actions(self => ({
      setFeatureData(data: any) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = {}
      },
    }))

  return stateModel
}
```

With [@jbrowse/mobx-state-tree](https://mobx-state-tree.js.org/), we're defining
the properties of our widget and the actions (mutations) it can take. You can
add any model properties you need — they're accessible in your React component
via `model`.

If you have a particularly complex model, consider moving it into a separate
`model.ts` and exporting it from `index.ts`, similar to how the ReactComponent
is exported.

### A widget's ReactComponent

Now that we have our model set up, let's build a simple widget that will open
when we click the circular genome view chord.

`CircularViewChordWidget.tsx`

```ts
import { observer } from 'mobx-react'
import {
  FeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

const CircularViewChordWidget = observer(({ model }: { model: any }) => {
  const { featureData } = model
  return (
    <div>
      <BaseCard title={featureData.name}>
        <FeatureDetails feature={featureData} model={model} />
      </BaseCard>
    </div>
  )
})

export default CircularViewChordWidget
```

The `observer` wrapper from mobx-react ensures the component re-renders when
model properties change. `@jbrowse/core` exports reusable components like
`FeatureDetails` and `BaseCard` — if you find something in the app you'd like to
reuse, check whether it's exported, and if not
[make a request](https://github.com/GMOD/jbrowse-components/discussions/new).

Now that we have our component built, we can install it into our plugin and test
it out.

## Register pluggable elements with JBrowse

The file `src/index.ts` exports your plugin and installs all the necessary
components to JBrowse at runtime such that it runs properly.

Your `src/index.ts` file is going to look something like the following right
now:

```ts
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { SessionWithWidgets, isAbstractMenuManager } from '@jbrowse/core/util'
import { version } from '../package.json'
import {
  ReactComponent as HelloViewReactComponent,
  stateModel as helloViewStateModel,
} from './HelloView'

export default class SomeNewPluginPlugin extends Plugin {
  name = 'SomeNewPluginPlugin'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'HelloView',
        stateModel: helloViewStateModel,
        ReactComponent: HelloViewReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Hello View',
        onClick: (session: SessionWithWidgets) => {
          session.addView('HelloView', {})
        },
      })
    }
  }
}
```

You'll notice we're already adding a new view type and configuring the rootModel
in the template's project. We can use these patterns to add our widget.

`src/index.ts`

```ts
// imports
// ...
import { ViewType, WidgetType } from '@jbrowse/core/pluggableElementTypes'
// notice we're importing the components we exported from src/CircularViewChordWidget/index.ts
import {
  configSchema as circularViewChordWidgetConfigSchema,
  stateModelFactory as circularViewChordWidgetStateModelFactory,
  ReactComponent as CircularViewChordWidgetComponent
} from './CircularViewChordWidget'
// ...
  install(pluginManager: PluginManager) {
    // ...
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'CircularViewChordWidget',
        heading: 'Chord Details',
        configSchema: circularViewChordWidgetConfigSchema,
        stateModel: circularViewChordWidgetStateModelFactory(pluginManager),
        ReactComponent: CircularViewChordWidgetComponent,
      })
    })
  }
// ...
```

This is also where we'll add our Jexl callback function:

`src/index.ts`

```ts
// ...
import { getSession } from '@jbrowse/core/util'
// ...
  // Jexl callback functions are adding inside configure in the plugin class
  configure(pluginManager: PluginManager) {
    // ...
    /* .jexl.addFunction is the method to add a function
       the first parameter is the name of your jexl function, and how you'll
       call it
       the second parameter is the supplementary properties the function
       needs, here, we need these three properties for
       the circular view's chord click function */
    pluginManager.jexl.addFunction(
      'openWidgetOnChordClick',
      (feature: any, chordTrack: any) => {
        // the session contains a ton of necessary information about the
        // present state of the app, here we use it to call the
        // showWidget function to show our widget upon chord click
        const session = getSession(chordTrack)

        if (session) {
          // @ts-expect-error
          session.showWidget(
            // @ts-expect-error
            session.addWidget(
              'CircularViewChordWidget',
              'circularViewChordWidget',
              { featureData: feature.toJSON() },
            ),
          )
          session.setSelection(feature)
        }
      },
    )
  }
// ...
```

Now that we've configured the jexl function to our JBrowse session, we can use
it essentially anywhere.

While we could programmatically tell certain displays to use this jexl function
when they perform an action, for our use case (clicking a chord on the circular
view), we can simply write it into our config file.

## Setup the configuration for proper testing

To open a view in JBrowse, we need an assembly configured, append the following
to your `jbrowse_config.json` file (i.e. after the "plugins" field):

```json
{
  "assemblies": [
    {
      "name": "hg38",
      "aliases": ["GRCh38"],
      "sequence": {
        "type": "ReferenceSequenceTrack",
        "trackId": "P6R5xbRqRr",
        "adapter": {
          "type": "BgzipFastaAdapter",
          "fastaLocation": {
            "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
            "locationType": "UriLocation"
          },
          "faiLocation": {
            "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai",
            "locationType": "UriLocation"
          },
          "gziLocation": {
            "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi",
            "locationType": "UriLocation"
          }
        }
      },
      "refNameAliases": {
        "adapter": {
          "type": "RefNameAliasAdapter",
          "location": {
            "uri": "https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt",
            "locationType": "UriLocation"
          }
        }
      }
    }
  ]
}
```

Now add a track that uses the jexl function. You could add it programmatically
to all tracks of this type, but here we configure it on a specific track:

```json
  "tracks": [
    {
      "type": "VariantTrack",
      "trackId": "demo_vcf",
      "name": "demo_vcf",
      "assemblyNames": ["hg38"],
      "category": ["Annotation"],
      "adapter": {
        "type": "VcfAdapter",
        "vcfLocation": {
          "locationType": "UriLocation",
          "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf"
        }
      },
      "displays": [
        {
          "type": "ChordVariantDisplay",
          "displayId": "demo_ch_v_disp",
          "onChordClick": "jexl:openWidgetOnChordClick(feature, track, pluginManager)",
          "renderer": { "type": "StructuralVariantChordRenderer" }
        }
      ]
    }
  ]
```

The key part is `onChordClick` on the `ChordVariantDisplay`, which calls the
jexl function we registered in the plugin.

<Figure src="/img/plugin-dev-tutorial-track-added.png" caption="A screenshot of what it will look like when you add a track to your configuration; that is, it will be available in the add track menu when you open a view." />

## Testing it out

### Run JBrowse with your new plugin and manually test

Everything is in place to test this widget we've added to the plugin project
out.

If you shut your instance down, restart JBrowse and your plugin (`yarn browse`
and `yarn start`).

Navigate to
[localhost:8999/?config=localhost:9000/jbrowse_config.json](localhost:8999/?config=localhost:9000/jbrowse_config.json)
or equivalent to see JBrowse running with your config.

Now navigate:

1. Click `Start a new session` → `Empty`
2. In the top menu bar, click `Add` → `Circular view`
3. When the view is open, click `Open` beside the assembly
4. Click the far right three rows of rectangles icon in the top left of the
   circular view, `Open track selector`
5. Select the track we populated from our config
6. Click any chord in the circular view

Expected result:

The widget opens on the right-hand side with two panels, one with our editable
widget byline, and one with our feature data.

<Figure src="/img/plugin-dev-tutorial-final.png" caption="A screenshot of the widget displayed after clicking on the chord." />

:::info Troubleshooting

If you get to this point and note that nothing happens, open the developer tools
in your browser and investigate the console errors. Also check your running
process in your terminal for any errors. Review the code you added to ensure you
didn't miss any imports or statements. Check over your config file to ensure
that "plugins", "assemblies", and "tracks" are all present for the configuration
to work properly.

:::

## Publish your plugin

Once the plugin is ready, publish it to NPM and submit it to the plugin store
so others can install it from within JBrowse. Future NPM releases are picked up
automatically by the store.

## Publish your plugin to NPM

You'll need an NPM account. If you'd prefer not to use NPM, host the plugin
files publicly elsewhere. From the plugin's root directory:

```bash
yarn publish
```

Once the package appears on NPM, proceed to the next step.

## Request your plugin be added to the plugin store

To populate your plugin to the plugin store, it must be added to the
[plugin list](https://github.com/GMOD/jbrowse-plugin-list), a whitelist of
JBrowse plugins.

Navigate to the
[plugin list repository](https://github.com/GMOD/jbrowse-plugin-list) and use
the GitHub UI to **Fork** the repository.

<Figure src="/img/publish_fork_repo_guide.png" caption="Click the 'Fork' option at the top of the repository to create an editable clone of the repo." />

:::info Tip

It's easy enough to edit the files required using the GitHub UI, but feel free
to clone and push to the forked repo using your local environment as well.

:::

### Optional: create an image for your plugin

An image helps communicate the capabilities of your plugin to adopters at a
glance. Consider creating an 800 x 200 `.png` screenshot of a core feature of
your plugin to show off.

We recommend using [pngquant](https://pngquant.org/) to compress your image to
keep the repo manageable.

Once your image is all set, you can upload it to your forked repo (ideally in
~/jbrowse-plugin-list/img/) using the Github UI or pushing the file from your
computer.

### Adding the details for your plugin to the list

Once forked, you can edit the `plugins.json` file to include the following
information regarding your new plugin:

`plugins.json`

```json
{
  "plugins": [
    // ...other plugins already published,
    {
      // this plugin name needs to match what is in your package.json
      "name": "SomeNewPlugin",
      "authors": ["You, dear reader!"],
      "description": "JBrowse 2 plugin that demonstrates adding a simple pluggable element",
      // change this to your github repo for your plugin
      "location": "https://github.com/ghost/jbrowse-plugin-some-new-plugin",
      // assuming you published to NPM, this url is going to be mostly the same, other than the correct name of your project
      "url": "https://unpkg.com/jbrowse-plugin-some-new-plugin/dist/jbrowse-plugin-some-new-plugin.umd.production.min.js",
      // make sure the license is accurate, otherwise use "NONE"
      "license": "MIT",
      // the image url will be wherever you placed it in the repo earlier, img is appropriate
      "image": "https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/plugin-screenshot-fs8.png"
    }
  ]
}
```

Push your changes to the `main` branch of your forked repo when you're done.

### Make a pull request

Now that your plugin's information is accurate, navigate again to the
[plugin list repository](https://github.com/GMOD/jbrowse-plugin-list), and
create a new pull request.

In the pull request UI, click "compare across forks" and select your fork as the
head repository to merge into the main of `jbrowse-plugin-list`. Your changes
should show in the editor, and you can create your PR.

<Figure src="/img/publish_compare_repo_guide.png" caption="Use the compare across forks option in the pull request UI to merge your forked repo's main branch into the jbrowse-plugin-list main branch."/>

## Next steps

The JBrowse team will review your PR and merge it when the plugin is functional.

For more on pluggable element types, see the
[developer guide](/docs/developer_guide). For questions, use the
[Gitter channel](https://app.gitter.im/#/room/#GMOD_jbrowse2:gitter.im) or
[GitHub discussions](https://github.com/GMOD/jbrowse-components/discussions).
