---
id: 04_publishing
title: Publishing a plugin to the store
toplevel: true
---

import Figure from '../../../figure'

Sometimes you might write a plugin that is specific to you or your organization's needs, but you also might want to share it with the greater community. That's where the [plugin store](/plugin_store) shows off its strengths.

As a plugin developer, you can publish your plugin to NPM, and then reqest that your plugin be added to the plugin store. After your plugin is successfully whitelisted, you will see it within the JBrowse app's plugin store widget and you and others can freely install the plugin into their JBrowse session. Any further publications you make to the plugin via NPM will automatically be updated for the plugin available through the plugin store.

The following document will describe how to accomplish this.

## Publish your plugin to NPM

The following will guide you through publishing with [NPM](https://www.npmjs.com/). You'll need an NPM account and token to do this, so please set that up first through the NPM site.

If you'd prefer not to publish to NPM, you can host your plugin files elsewhere, just ensure the link is accessible publicly.

When your plugin is in a publishable state and you have NPM credentials, you can run the following within your plugin's root directory (where `package.json` is found):

```bash
yarn publish
```

Set the version to whatever you'd like, enter your credentials, and then complete the publication process. Once you can see your package on NPM, move on to the next step.

## Request your plugin be added to the plugin store

To populate your plugin to the plugin store, it must be added to the [plugin list](https://github.com/GMOD/jbrowse-plugin-list), a whitelist of JBrowse plugins.

Navigate to the [plugin list repository](https://github.com/GMOD/jbrowse-plugin-list) and use the github UI to **Fork** the repository.

<Figure src="/img/publish_fork_repo_guide.png" caption="Click the 'Fork' option at the top of the repository to create an editable clone of the repo." />

:::info Tip

It's easy enough to edit the files required using the github UI, but feel free to clone and push to the forked repo using your local environment as well.

:::

### Optional: create an image for your plugin

An image helps communicate the capabilities of your plugin to adopters at a glance. Consider creating an 800 x 200 `.png` screenshot of a core feature of your plugin to show off.

We recommend using [pngquant](https://pngquant.org/) to compress your image to keep the repo manageable.

Once your image is all set, you can upload it to your forked repo (ideally in ~/jbrowse-plugin-list/img/) using the Github UI or pushing the file from your computer.

### Adding the details for your plugin to the list

Once forked, you can edit the `plugins.json` file to include the following information regarding your new plugin:

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

Now that your plugin's information is accurate, navigate again to the [plugin list repository](https://github.com/GMOD/jbrowse-plugin-list), and create a new pull request.

In the pull request UI, click "compare across forks" and select your fork as the head repository to merge into the main of `jbrowse-plugin-list`. Your changes should show in the editor, and you can create your PR.

<Figure src="/img/publish_compare_repo_guide.png" caption="Use the compare across forks option in the pull request UI to merge your forked repo's main branch into the jbrowse-plugin-list main branch."/>

## Next steps

The JBrowse development team will review your plugin to ensure that it is functional, then when it is merged in the plugin will be available on the plugin store.
