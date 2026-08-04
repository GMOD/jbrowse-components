// A synteny view can be launched against any assembly the track spans, i.e. one
// of the track's declared assemblyNames. This is static config, so it holds
// whether or not the assembly is loaded yet — an unloaded one resolves on demand
// (e.g. via a connection) when the view opens. A one-vs-all mate that is only a
// PanSN sample label rather than a listed assembly is absent from assemblyNames,
// so the launch option stays hidden for it.
//
// Its own module rather than a corner of buildSyntenyViewSpec: this is the gate
// every *offer* of a launch is drawn behind (the LGV synteny context menu, the
// feature-detail link, the region launch's mate discovery), and those all run
// long before anyone clicks. Reaching for it through the spec builder pulled
// parseCigar2 and launchSyntenyView into a display's module graph for a
// three-line predicate, next to the lazy() the same file uses to keep the dialog
// itself out.
export function canLaunchSyntenyForMate(
  trackAssemblyNames: string[],
  mateAssembly: string | undefined,
) {
  return mateAssembly !== undefined && trackAssemblyNames.includes(mateAssembly)
}
