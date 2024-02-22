---
id: embedded_components
title: Embedded components
toplevel: true
---

Our embedded components allow you to use JBrowse in your application

## @jbrowse/react-app

This component embodies the entire jbrowse-web application as a NPM installable
react component

- [@jbrowse/react-app](https://www.npmjs.com/package/@jbrowse/react-app) jbrowse
  app component on NPM
- [Storybook](https://jbrowse.org/storybook/app/main/) - docs for the app
  component

Here is a table of different usages of the `@jbrowse/react-app` using different
bundlers

| Bundler             | Demo                                            | Source code                                                             | Note                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-react-app v5 | [demo](https://jbrowse.org/demos/app-cra5/)     | [source code](https://github.com/GMOD/jbrowse-react-app-cra5-demo)      | for create-react-app v5, we use craco to update the webpack config to polyfill some node modules. This demo also uses webworkers, which is a unique ability with webpack 5. See https://jbrowse.org/storybook/app/main/ for details |
| next.js             | [demo](https://jbrowse.org/demos/app-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-app-nextjs-demo)    | uses next.js 13. Currently is hardcoded to use /demos/app-nextjs/ as sub-uri, update next.config.js to customize as needed                                                                                                          |
| vite                | [demo](https://jbrowse.org/demos/app-vite)      | [source code](https://github.com/GMOD/jbrowse-react-app-vite-demo)      |                                                                                                                                                                                                                                     |
| vanillajs           | [demo](https://jbrowse.org/demos/app-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-app-vanillajs-demo) |                                                                                                                                                                                                                                     |

## @jbrowse/react-linear-genome-view

This NPM package consists of a single linear genome view that is usable as a
React component

- [@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)
  linear genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/lgv/main/) - docs for the linear
  genome view React component

Here is a table of different usages of the `@jbrowse/react-linear-genome-view`
using different bundlers

| Bundler             | Demo                                            | Source code                                                                            | Note                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-react-app v4 | [demo](https://jbrowse.org/demos/lgv/)          | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-cra4-demo)      | no polyfills needed in create-react-app v4. on newer versions of node, you can need to use `export NODE_OPTIONS=--openssl-legacy-provider` before building cra4 apps                                                                |
| create-react-app v5 | [demo](https://jbrowse.org/demos/lgv-cra5/)     | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-cra5-demo)      | for create-react-app v5, we use craco to update the webpack config to polyfill some node modules. This demo also uses webworkers, which is a unique ability with webpack 5. See https://jbrowse.org/storybook/lgv/main/ for details |
| vite                | [demo](https://jbrowse.org/demos/lgv-vite)      | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-vite-demo)      | for vite, we use rollup to polyfill some node polyfills similar to craco in create-react-app v5.                                                                                                                                    |
| next.js             | [demo](https://jbrowse.org/demos/lgv-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-nextjs-demo)    | uses next.js 13. Currently is hardcoded to use /demos/lgv-nextjs/ as sub-uri, update next.config.js to customize as needed                                                                                                          |
| vanilla js          | [demo](https://jbrowse.org/demos/lgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo) | uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling. see also dev tutorial here https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/01_introduction/                           |

## @jbrowse/react-circular-genome-view

This component consists of a single JBrowse 2 circular view.

- [@jbrowse/react-circular-genome-view](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view)
  circular genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/cgv/main/) - docs for the circular
  genome view React component

Here is a table of different usages of the `@jbrowse/react-circular-genome-view`
using different bundlers

| Syntax              | Demo                                            | Source code                                                                              | Note                                                                                                                                                                 |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-react-app v4 | [demo](https://jbrowse.org/demos/cgv/)          | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-cra4-demo)      | no polyfills needed in create-react-app v4. on newer versions of node, you can need to use `export NODE_OPTIONS=--openssl-legacy-provider` before building cra4 apps |
| create-react-app v5 | [demo](https://jbrowse.org/demos/cgv-cra5/)     | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-cra5-demo)      | for create-react-app v5, we use craco to update the webpack config to polyfill some node modules                                                                     |
| vanilla js          | [demo](https://jbrowse.org/demos/cgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-vanillajs-demo) | uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling                                                                         |
| nextjs              | [demo](https://jbrowse.org/demos/cgv-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-nextjs-demo)    | uses next.js                                                                                                                                                         |
