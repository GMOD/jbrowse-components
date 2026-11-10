import { viewAndNested } from './openViews.ts'

import type { AbstractViewModel } from './types/index.ts'

/**
 * An assembly config snapshot a view or display declares, for an assembly only
 * it can draw: a read-vs-ref launch's read, a multi-way lane's genome.
 */
export interface SyntheticAssemblySnapshot {
  name: string
}

/** A view or display declaring synthetic assemblies. */
export interface SyntheticAssemblySource {
  syntheticAssemblies?: readonly SyntheticAssemblySnapshot[]
}

/**
 * Every synthetic assembly the views and the views nested in them declare. The
 * assembly manager builds an assembly for each name and drops it when the last
 * declaration goes, so the owner's lifetime is the assembly's. A display
 * declares through its view (`addSyntheticAssemblySource`), since asking every
 * display would build each lazily built track. ADR-261.
 */
export function declaredSyntheticAssemblies(views: AbstractViewModel[] = []) {
  return views
    .flatMap(viewAndNested)
    .flatMap(view => view.syntheticAssemblies ?? [])
}
