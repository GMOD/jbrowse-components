import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

// The session UI — @jbrowse/app-core's App, and with it dockview, the drawer
// widgets and their Material chrome — is what the start screen exists to get you
// to, not what it is made of. Lazy so launching to the start screen doesn't
// evaluate it first; each way of opening a session preloads it beside the plugin
// manager build, so the first render takes it synchronously instead of
// committing a Suspense fallback whose reveal React holds for 300ms.
export const LazyJBrowse = lazyWithPreload(() => import('./JBrowse.tsx'))
