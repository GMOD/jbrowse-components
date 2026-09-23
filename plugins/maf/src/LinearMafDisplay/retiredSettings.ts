import type PluginManager from '@jbrowse/core/PluginManager'

const DISPLAY_TYPE = 'LinearMafDisplay'

const RETIRED_STATE = [
  'layout',
  'clusterTree',
  'clusterProvenance',
  'subtreeFilter',
]

// A track's `displays` union runs every member's preprocessor over every
// entry while it works out which display an entry is, so a snapshot naming
// another display is left alone. One naming no type is a bag of settings
// headed for this display and is checked.
function isOwnSnapshot(snap: Record<string, unknown>) {
  return snap.type === undefined || snap.type === DISPLAY_TYPE
}

export function refuseRetiredConfig(snap: Record<string, unknown>) {
  if (isOwnSnapshot(snap) && snap.domain !== undefined) {
    throw new Error(
      `${DISPLAY_TYPE}: \`domain\` is \`rows.domain\` (\`rows: { domain: [...] }\`), the row order beside the labels, tree and focus`,
    )
  }
  return snap
}

export function refuseRetiredState(snap: Record<string, unknown>) {
  const retired = isOwnSnapshot(snap)
    ? RETIRED_STATE.filter(key => key in snap)
    : []
  if (retired.length) {
    throw new Error(
      `${retired.join(', ')} on a ${DISPLAY_TYPE}: the row arrangement is the display config's \`rows\` object (domain, labels, tree, treeProvenance, kept) and its tints \`rowColor\``,
    )
  }
  return snap
}

/**
 * `displayDefaults.domain` on a MAF track is the spelling `rows.domain`
 * replaced. No display declares it now, so the shorthand router would drop it
 * with a console warning. Moved onto an explicit MAF entry instead, it meets
 * that display's own refusal, which names the replacement.
 */
export function routeRetiredShorthand(snap: Record<string, unknown>) {
  const written = snap.displayDefaults as Record<string, unknown> | undefined
  if (written?.domain === undefined) {
    return snap
  }
  const { domain, ...rest } = written
  const displays = Array.isArray(snap.displays)
    ? (snap.displays as Record<string, unknown>[])
    : []
  const maf = displays.find(d => d.type === DISPLAY_TYPE)
  return {
    ...snap,
    displayDefaults: rest,
    displays: maf
      ? displays.map(d => (d === maf ? { ...d, domain } : d))
      : [
          ...displays,
          {
            type: DISPLAY_TYPE,
            displayId: `${snap.trackId}-${DISPLAY_TYPE}`,
            domain,
          },
        ],
  }
}

export function routeRetiredShorthandF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap =>
    snap.type === 'MafTrack' ? routeRetiredShorthand(snap) : snap,
  )
}
