import { isLooseTrackConfig } from '../../packages/add-track-core/src/index.ts'

// A parsed block is a complete track config when it carries the three things
// `tracks` entries always have, or is the whole-track shorthand (a `trackId`
// over a `uri`, by the app's own loose-track rule); an assembly when it has a
// name plus a sequence (or the flattest `uri` shorthand for one); a view when
// its `type` names one, which is the session spec's unit and has `tracks` of
// its own.
export function configBlockShape(obj: Record<string, unknown>) {
  const type = typeof obj.type === 'string' ? obj.type : ''
  const keys = Object.keys(obj)
  return type.endsWith('View')
    ? 'view'
    : Array.isArray(obj.assemblies) || Array.isArray(obj.tracks)
      ? 'config'
      : type.endsWith('Adapter')
        ? 'adapter'
        : type.endsWith('Display')
          ? 'display'
          : obj.trackId &&
              ((obj.adapter && obj.type) || isLooseTrackConfig(obj))
            ? 'track'
            : obj.name && (obj.sequence ?? obj.uri)
              ? 'assembly'
              : keys.length > 0 &&
                  keys.every(k => k === 'displayDefaults' || k === 'displays')
                ? 'fragment'
                : 'other'
}
