function isAdapterConfig(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function namesIn(value: unknown) {
  return Array.isArray(value)
    ? value.filter((name): name is string => typeof name === 'string')
    : []
}

function ownAssemblyNames(adapterConfig: Record<string, unknown>) {
  const { assemblyNames, queryAssembly, targetAssembly, blockAssemblies } =
    adapterConfig
  const declared = namesIn(assemblyNames)
  const pair = [queryAssembly, targetAssembly].filter(
    (name): name is string => typeof name === 'string',
  )
  return declared.length > 0
    ? declared
    : pair.length > 0
      ? pair
      : [...new Set(namesIn(blockAssemblies))]
}

function sharedNamesFirst(childNames: string[][]) {
  const all = [...new Set(childNames.flat())]
  const shared = all.filter(name =>
    childNames.every(names => names.includes(name)),
  )
  return [...shared, ...all.filter(name => !shared.includes(name))]
}

/**
 * The assemblies a comparative adapter config names, spelled as it spells
 * them, which are the names its adapter compares a region's `assemblyName`
 * against:
 *
 * - `assemblyNames`, which most comparative adapters declare
 * - else the pairwise `queryAssembly`/`targetAssembly` pair, in that order
 * - else an MCScan blocks table's `blockAssemblies`, each column's genome once
 * - else what the child configs in `adapters` name, the one every child shares
 *   (a star's anchor) first
 *
 * A config naming no assembly answers `[]`. It reads the config snapshot, so
 * the main thread can respell a region into the adapter's namespace before the
 * RPC, and the pairwise adapters read their own pair through it too.
 */
export function adapterAssemblyNames(adapterConfig: Record<string, unknown>) {
  const own = ownAssemblyNames(adapterConfig)
  const { adapters } = adapterConfig
  return own.length > 0 || !Array.isArray(adapters)
    ? own
    : sharedNamesFirst(adapters.filter(isAdapterConfig).map(ownAssemblyNames))
}
