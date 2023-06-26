# jbrowse-react-linear-genome-view-nextjs

This is a demo of using the linear genome view with next.js (which uses webpack
5).

# Demo of `@jbrowse/react-circular-genome-view` with next.js

See this app running at https://jbrowse.org/demos/cgv-nextjs/.

Download this directory from the monorepo using

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

## Deploy

This page is deployed to https://jbrowse.org/demos/cgv-nextjs (uses
`yarn build && yarn export` to create static build with no server side)

## Notes

Note that tsconfig.json had to be updated to target >ES5 and

```
transpilePackages: ['@jbrowse/react-circular-genome-view'],
```

added to the `next.config.js` file.
