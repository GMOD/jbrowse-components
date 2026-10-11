/**
 * What a saved session holds, for telling saved sessions apart in a recent
 * list without opening them. Read off the snapshot rather than a live model,
 * so it can be taken wherever the snapshot is written.
 */
export interface SessionSummary {
  assemblies: string[]
  views: number
  tracks: number
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

/**
 * Walks every view, including the subviews a comparative view nests, so a
 * synteny view's assemblies and tracks count the same as two plain views'.
 */
export function summarizeSession(snap: unknown): SessionSummary {
  const assemblies = new Set<string>()
  let tracks = 0
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child)
      }
    } else if (isRecord(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'assemblyName' && typeof value === 'string') {
          assemblies.add(value)
        } else if (key === 'assemblyNames' && Array.isArray(value)) {
          for (const name of value) {
            if (typeof name === 'string') {
              assemblies.add(name)
            }
          }
        } else if (key === 'tracks' && Array.isArray(value)) {
          tracks += value.length
        } else {
          visit(value)
        }
      }
    }
  }
  const views = isRecord(snap) && Array.isArray(snap.views) ? snap.views : []
  visit(views)
  return { assemblies: [...assemblies], views: views.length, tracks }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function formatSessionSummary({
  assemblies,
  views,
  tracks,
}: SessionSummary) {
  const shown = assemblies.slice(0, 2).join(', ')
  const more = assemblies.length - 2
  return views
    ? [
        more > 0 ? `${shown} +${more} more` : shown,
        plural(views, 'view'),
        tracks ? plural(tracks, 'track') : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No views'
}
