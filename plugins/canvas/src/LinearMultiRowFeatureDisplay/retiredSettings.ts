const DISPLAY_TYPE = 'LinearMultiRowFeatureDisplay'

const RETIRED_CONFIG: Record<string, string> = {
  partitionField: '`rows` (`rows: "sample"`, or `rows: { field, domain }`)',
  domain: '`rows.domain`',
  sampleColorMap: '`rowColor: { domain: [...rows], range: [...colors] }`',
}

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
  if (isOwnSnapshot(snap)) {
    const retired = Object.keys(RETIRED_CONFIG).filter(
      key => snap[key] !== undefined,
    )
    if (retired.length) {
      throw new Error(
        `${DISPLAY_TYPE}: ${retired.map(key => `\`${key}\` is ${RETIRED_CONFIG[key]}`).join('; ')}`,
      )
    }
  }
  return snap
}

export function refuseRetiredState(snap: Record<string, unknown>) {
  const retired = isOwnSnapshot(snap)
    ? RETIRED_STATE.filter(key => key in snap)
    : []
  if (retired.length) {
    throw new Error(
      `${retired.join(', ')} on a ${DISPLAY_TYPE}: the row arrangement is the display config's \`rows\` object (domain, labels, tree, treeProvenance, kept) and its colours \`rowColor\``,
    )
  }
  return snap
}

export const RETIRED_SHORTHAND = Object.keys(RETIRED_CONFIG)
