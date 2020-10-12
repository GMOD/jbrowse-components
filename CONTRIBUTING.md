We welcome contributions

## Source editing

See the README.md for how to get started as a developer

A lot of the jbrowse codebase is structured into many "plugins" in the plugins

The products/jbrowse-web and products/jbrowse-desktop are "front ends" that
bundle the plugins and add some extra organization

We suggest having lint-on-save configured for your source code editor, or you can run `yarn lint --fix` to fix source code changes.

##

## Adding images to the docs

Please use pngquant before adding images to the docs

## Making a release

To make a release of jbrowse-components tools, run the following

```sh
yarn run lerna-publish
```

This will analyze which packages have changed, and prompt you to publish each
package in the monorepo individually.
