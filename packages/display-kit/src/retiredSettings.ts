type Snapshot = Record<string, unknown>

/**
 * The refusals a display raises for settings the row-model port retired, and
 * the track-level router that lets a `displayDefaults` spelling reach them.
 *
 * `config` names each retired config slot and what replaced it; `state` lists
 * the retired state-model props. A track's `displays` union runs every
 * member's preprocessor over every entry while it works out which display an
 * entry is, so a snapshot naming another display type is left alone, and one
 * naming no type is a bag of settings headed for this display and is checked.
 */
export function retiredSettings({
  displayType,
  trackType,
  config,
  state,
}: {
  displayType: string
  trackType: string
  config: Record<string, string>
  state: readonly string[]
}) {
  const shorthand = Object.keys(config)

  function isOwnSnapshot(snap: Snapshot) {
    return snap.type === undefined || snap.type === displayType
  }

  function refuseRetiredConfig(snap: Snapshot) {
    const retired = isOwnSnapshot(snap)
      ? shorthand.filter(key => snap[key] !== undefined)
      : []
    if (retired.length) {
      throw new Error(
        `${displayType}: ${retired.map(key => `\`${key}\` is ${config[key]}`).join('; ')}`,
      )
    }
    return snap
  }

  function refuseRetiredState(snap: Snapshot) {
    const retired = isOwnSnapshot(snap) ? state.filter(key => key in snap) : []
    if (retired.length) {
      throw new Error(
        `${retired.join(', ')} on a ${displayType}: the row arrangement is the display config's \`rows\` object (domain, labels, tree, treeProvenance, kept) and its colours \`rowColor\``,
      )
    }
    return snap
  }

  /**
   * A retired key under `displayDefaults` would be dropped by the shorthand
   * router with a console warning, since no display declares it now. Moved
   * onto an explicit entry for this display instead, it meets the refusal
   * above, which names the replacement.
   */
  function routeRetiredShorthand(snap: Snapshot) {
    const written = snap.displayDefaults as Snapshot | undefined
    const retired = shorthand.filter(key => written?.[key] !== undefined)
    if (!written || !retired.length) {
      return snap
    }
    const moved = Object.fromEntries(retired.map(key => [key, written[key]]))
    const rest = Object.fromEntries(
      Object.entries(written).filter(([key]) => !retired.includes(key)),
    )
    const displays = Array.isArray(snap.displays)
      ? (snap.displays as Snapshot[])
      : []
    const own = displays.find(d => d.type === displayType)
    return {
      ...snap,
      displayDefaults: rest,
      displays: own
        ? displays.map(d => (d === own ? { ...d, ...moved } : d))
        : [
            ...displays,
            {
              type: displayType,
              displayId: `${snap.trackId}-${displayType}`,
              ...moved,
            },
          ],
    }
  }

  return {
    refuseRetiredConfig,
    refuseRetiredState,
    routeRetiredShorthand,
    routeTrackShorthand: (snap: Snapshot) =>
      snap.type === trackType ? routeRetiredShorthand(snap) : snap,
  }
}
