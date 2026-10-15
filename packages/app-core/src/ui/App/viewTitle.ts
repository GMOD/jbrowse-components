interface TitledView {
  displayName?: string
  assemblyNames?: string[]
  minimized?: boolean
  initialized?: boolean
  showImportForm?: boolean
  error?: unknown
}

/**
 * The view's own name, or its assemblies'. An emptied name counts as unset, so
 * clearing the title in the header puts the derived one back. A view still
 * resolving its assembly is not untitled, only unnamed so far, so it reads
 * blank rather than "Untitled view" for the moment before its name arrives.
 */
export function viewName(
  view: TitledView,
  getDisplayName: (assemblyName: string) => string,
) {
  // assemblyNames is [] (not undefined) for a view with no displayed regions
  // yet, so fall back on emptiness rather than nullishness
  const assemblyNames = view.assemblyNames ?? []
  const launching =
    view.initialized === false && !view.showImportForm && !view.error
  return (
    view.displayName ||
    (assemblyNames.length
      ? assemblyNames.map(r => getDisplayName(r)).join(', ')
      : launching
        ? ''
        : 'Untitled view')
  )
}

export function viewTitle(
  view: TitledView,
  getDisplayName: (assemblyName: string) => string,
) {
  const name = viewName(view, getDisplayName)
  return view.minimized ? `${name} (minimized)` : name
}
