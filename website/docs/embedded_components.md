---
id: embedded_components
title: Embedded components
toplevel: true
---

Our embedded components allow you to embed JBrowse components on your webpage

You can see a tutorial for setting up the embedded components here
https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/

See also our FAQ entry on embedded components
http://jbrowse.org/jb2/docs/faq/#embedded-views-versus-full-jbrowse-app

## @jbrowse/react-app2

This component embodies the entire jbrowse-web application as a NPM installable
react component

- [@jbrowse/react-app2](https://www.npmjs.com/package/@jbrowse/react-app2)
  jbrowse app component on NPM
- [Storybook](https://jbrowse.org/storybook/app/main/) - docs for the app
  component

Here is a table of different usages of the `@jbrowse/react-app2` using different
bundlers

| Bundler   | Demo                                            | Source code                                                             | Note                                                                                                                     |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| next.js   | [demo](https://jbrowse.org/demos/app-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-app-nextjs-demo)    | Uses next.js. Currently is hardcoded to use /demos/app-nextjs/ as sub-uri, update next.config.js to customize as needed. |
| vite      | [demo](https://jbrowse.org/demos/app-vite)      | [source code](https://github.com/GMOD/jbrowse-react-app-vite-demo)      | Uses vite. This demo was updated to utilize the webworkers in 2024                                                       |
| rsbuild   | [demo](https://jbrowse.org/demos/app-rsbuild)   | [source code](https://github.com/GMOD/jbrowse-react-app-rsbuild-demo)   | Uses rsbuild (https://rsbuild.dev/)                                                                                      |
| vanillajs | [demo](https://jbrowse.org/demos/app-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-app-vanillajs-demo) |                                                                                                                          |

## @jbrowse/react-linear-genome-view2

This NPM package consists of a single linear genome view that is usable as a
React component

- [@jbrowse/react-linear-genome-view2](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view2)
  linear genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/lgv/main/) - docs for the linear
  genome view React component

Here is a table of different usages of the `@jbrowse/react-linear-genome-view2`
using different bundlers

| Bundler    | Demo                                            | Source code                                                                            | Note                                                                                                                                                                                      |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vite       | [demo](https://jbrowse.org/demos/lgv-vite)      | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-vite-demo)      | Uses vite. This demo was updated to utilize webworkers in 2024                                                                                                                            |
| rsbuild    | [demo](https://jbrowse.org/demos/lgv-rsbuild)   | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-rsbuild-demo)   | Uses rsbuild (https://rsbuild.dev/)                                                                                                                                                       |
| next.js    | [demo](https://jbrowse.org/demos/lgv-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-nextjs-demo)    | Uses next.js. Currently is hardcoded to use /demos/lgv-nextjs/ as sub-uri, update next.config.js to customize as needed. This demo was updated to use webworkers in 2024                  |
| vanilla js | [demo](https://jbrowse.org/demos/lgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-linear-genome-view-vanillajs-demo) | Uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling. see also dev tutorial here https://jbrowse.org/jb2/docs/tutorials/embed_linear_genome_view/ |

## @jbrowse/react-circular-genome-view2

This component consists of a single JBrowse 2 circular view.

- [@jbrowse/react-circular-genome-view2](https://www.npmjs.com/package/@jbrowse/react-circular-genome-view2)
  circular genome view React component on NPM
- [Storybook](https://jbrowse.org/storybook/cgv/main/) - docs for the circular
  genome view React component

Here is a table of different usages of the
`@jbrowse/react-circular-genome-view2` using different bundlers

| Syntax     | Demo                                            | Source code                                                                              | Note                                                                                         |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| vanilla js | [demo](https://jbrowse.org/demos/cgv-vanillajs) | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-vanillajs-demo) | Uses a script tag to include a UMD bundle, and doesn't require any transpilation or bundling |
| nextjs     | [demo](https://jbrowse.org/demos/cgv-nextjs)    | [source code](https://github.com/GMOD/jbrowse-react-circular-genome-view-nextjs-demo)    | Uses next.js                                                                                 |
