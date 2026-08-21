import { getSession, isSessionWithAddSessionTrack } from '@jbrowse/core/util'

export interface SequenceSearchModel {
  assemblyNames: string[]
  showTrack: (trackId: string) => void
}

// Props for a search-mode panel: it renders its own fields and action buttons
// and creates the track itself, so the dialog is only the mode toggle around it.
export interface SequenceSearchModeProps {
  model: SequenceSearchModel
  handleClose: () => void
}

// Creates a FeatureTrack that scans the assembly's reference sequence and shows
// it. `adapter` carries the type + params only: the scan adapters resolve the
// sequence from the track's assembly at fetch time (getSequenceSubAdapter), so
// no sequence adapter is baked into the track config here.
export function addReferenceScanTrack(
  model: SequenceSearchModel,
  args: { trackId: string; name: string; adapter: Record<string, unknown> },
) {
  const session = getSession(model)
  const assemblyName = model.assemblyNames[0]!
  if (isSessionWithAddSessionTrack(session)) {
    session.addSessionTrackConf({
      trackId: args.trackId,
      name: args.name,
      assemblyNames: [assemblyName],
      type: 'FeatureTrack',
      adapter: args.adapter,
    })
    model.showTrack(args.trackId)
  } else {
    session.notify('This session does not support adding tracks', 'warning')
  }
}
