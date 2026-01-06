import type { Track } from '../../base.ts'

export function validateTrackConfigs(tracks: Track[]): void {
  if (!tracks.length) {
    throw new Error(
      'Tracks not found in config.json, please add track configurations before indexing.',
    )
  }
}

export function validateFileInput(file?: string | string[]): void {
  if (!file) {
    throw new Error('Cannot index file list without files')
  }
}

export function validateAssembliesForPerTrack(assemblies?: string): void {
  if (assemblies) {
    throw new Error(
      `Can't specify assemblies when indexing per track, remove assemblies flag to continue.`,
    )
  }
}
