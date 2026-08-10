// esbuild resolves a side-effect CSS import into the page's stylesheet output.
// tsc has no idea what a .css file is, so say that importing one is legal and
// yields nothing.
declare module '*.css'
