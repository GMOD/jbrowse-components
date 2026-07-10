// Bridge module for React.lazy code-splitting: lazy() needs a local module
// with a default export, so we re-export the shared cross-package component
// here and lazy-import this file from index.ts. Keeps it out of cold load.
export { BaseLinearDisplayComponent as default } from '@jbrowse/plugin-linear-genome-view'
