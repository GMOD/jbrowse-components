import {
  markdownTable,
  markerBlocksInDocs,
  rewriteMarkerBlock,
} from './util.ts'

// Which docs render each generated marker block, read off the docs themselves.
//
// ARCHITECTURE.md carried this by hand as six rows, under a sentence telling
// the reader not to hand-edit between a marker pair "anywhere, here or under
// `website/docs`" — while thirty-two markers were in use, and while the
// generated table three sections further down that same file
// (`DISPLAY_HOOK_OVERRIDES`) was not one of the six. A reader checking whether
// the block in front of them is generated got "no" for most of them.
//
// The list is the docs' own marker pairs rather than a registry of what the
// generators asked for, which is what makes it complete and self-including:
// this table lists its own row. `assertMarkersAndDocsAgree` is the other half —
// it compares this same scan against what the run actually wrote, so neither a
// generated table with no page nor a page with an ungenerated block can survive
// a run.
export function writeMarkerIndexDocs({ check = false } = {}) {
  const rows = [...markerBlocksInDocs()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([marker, docs]) =>
        `| \`${marker}\` | ${[...docs]
          .sort()
          .map(doc => `\`${doc}\``)
          .join('<br />')} |`,
    )
  return rewriteMarkerBlock(
    'MARKER_INDEX',
    markdownTable(['Marker', 'Rendered in'], rows),
    { check },
  )
}
