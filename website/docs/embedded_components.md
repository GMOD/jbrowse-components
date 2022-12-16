---
id: embedded_components
title: Embedded components
toplevel: true
---

Our embedded components allow you to use individual JBrowse views in your
application

## JBrowse React Linear Genome View

This component consists of a single JBrowse 2 linear view.

- [@jbrowse/react-linear-genome-view](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view)
  linear genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/lgv/main/) - docs for the linear
  genome view React component

Here is a table of different usages of the `@jbrowse/react-linear-genome-view`
using different bundlers

| Bundler             | Demo                                            | Source code                                                                                                                                                                                                                                                                                                            | Note                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-react-app v4 | [demo](https://jbrowse.org/demos/lgv/)          | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-linear-genome-view) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view))                     | no polyfills needed in create-react-app v4. on newer versions of node, you can need to use `export NODE_OPTIONS=--openssl-legacy-provider` before building cra4 apps                                                                                                         |
| create-react-app v5 | [demo](https://jbrowse.org/demos/lgv-cra5/)     | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-linear-genome-view-cra5) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view-cra5))           | for create-react-app v5, we use craco to update the webpack config to polyfill some node modules. This demo also uses webworkers, which is a unique ability with webpack 5. See https://jbrowse.org/storybook/lgv/main/?path=/story/linear-view--with-web-worker for details |
| vite                | [demo](https://jbrowse.org/demos/lgv-vite)      | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-linear-genome-view-vite) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view-vite))           | for vite, we use rollup to polyfill some node polyfills similar to craco in create-react-app v5.                                                                                                                                                                             |
| next.js             | [demo](https://jbrowse.org/demos/lgv-nextjs)    | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-linear-genome-view-nextjs) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view-nextjs))       | uses next.js 13. Currently is hardcoded to use /demos/lgv-nextjs/ as sub-uri, update next.config.js to customize as needed                                                                                                                                                   |
| vanilla js          | [demo](https://jbrowse.org/demos/lgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-linear-genome-view-vanillajs) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view-vanillajs)) | uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling. see also dev tutorial here https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/01_introduction/                                                                    |

## JBrowse React Circular Genome View

This component consists of a single JBrowse 2 circular view.

- [@jbrowse/react-circular-genome-view](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view)
  circular genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/cgv/main/) - docs for the circular
  genome view React component

Here is a table of different usages of the `@jbrowse/react-circular-genome-view`
using different bundlers

| Syntax              | Demo                                            | Source code                                                                                                                                                                                                                                                                                                                | Note                                                                                                                                                                 |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create-react-app v4 | [demo](https://jbrowse.org/demos/cgv/)          | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-circular-genome-view) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-circular-genome-view))                     | no polyfills needed in create-react-app v4. on newer versions of node, you can need to use `export NODE_OPTIONS=--openssl-legacy-provider` before building cra4 apps |
| create-react-app v5 | [demo](https://jbrowse.org/demos/cgv-cra5/)     | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-circular-genome-view-cra5) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-circular-genome-view-cra5))           | for create-react-app v5, we use craco to update the webpack config to polyfill some node modules                                                                     |
| vanilla js          | [demo](https://jbrowse.org/demos/cgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-components/tree/main/embedded_demos/jbrowse-react-circular-genome-view-vanillajs) ([download](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-circular-genome-view-vanillajs)) | uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling                                                                         |
