export function viewTitle(
  view: {
    displayName?: string
    assemblyNames?: string[]
    minimized: boolean
  },
  getDisplayName: (assemblyName: string) => string,
) {
  // assemblyNames is [] (not undefined) for a view with no displayed regions
  // yet, so fall back on emptiness rather than nullishness
  const assemblyNames = view.assemblyNames ?? []
  return (
    view.displayName ??
    `${
      assemblyNames.length
        ? assemblyNames.map(r => getDisplayName(r)).join(',')
        : 'Untitled view'
    }${view.minimized ? ' (minimized)' : ''}`
  )
}
