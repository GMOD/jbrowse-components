# vite with @jbrowse/react-linear-genome-view

Based on https://codesandbox.io/s/ylt4t?file=/vite.config.ts:478-540 by
@garrettjstevens

This is a demo of using the linear genome view with vite (see
https://vitejs.dev/)

Vite is a build system that is very fast and becoming more popular, using
esbuild and rollup instead of webpack

This particular demo includes several polyfills that are needed for JBrowse
including the Buffer polyfill

# Demo of `@jbrowse/react-linear-genome-view` with vite

See this app running at https://jbrowse.org/demos/lgv-vite/.

Download this directory from the monorepo using
https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2FGMOD%2Fjbrowse-components%2Ftree%2Fmain%2Fembedded_demos%2Fjbrowse-react-linear-genome-view-vite

## Usage

Run `yarn` and then `yarn dev` to start a development instance

Run `yarn build` which produces a `build` directory that can be deployed to a
static web server
