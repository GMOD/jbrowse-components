import fs from 'fs'

import { scanSpecKeys } from './generateSpecKeyDocs.ts'
import { markdownTable, rewriteMarkerBlock, tableCell } from './util.ts'

import type { SourceCorpus } from './util.ts'

// The `LaunchView-<type>` extension points, rendered into the extension-points
// guide from the same registry `SPEC_KEYS` reads on the URL parameters page.
//
// The guide hand-listed all three columns, and each was a different way to go
// stale. The point ids are the registry, which is the thing `SPEC_KEYS` exists
// to stop anyone hand-listing — this was the third copy of it, and the only one
// with no check. The middle column deep-links into `urlparams.md` by anchor,
// which is a heading slug on another page: rename the heading and the link 404s
// with nothing to notice. The right column pins a GitHub path per launcher,
// which survives exactly until a launcher moves.
//
// So all three come off the source now:
//
// - the ids and the `Launch*Args` name from the `'LaunchView-<type>': {args: X}`
//   entries the launchers add to `ExtensionPointRegistry` (`scanSpecKeys`
//   already collects these — one scan, not two);
// - the args type's file from wherever that name is exported;
// - the link text and anchor from the `###` heading standing over that view
//   type's `SPEC_KEYS` block on the URL parameters page, so the two pages agree
//   about what the section is called by construction.
//
// A launchable view type whose args type or `SPEC_KEYS` block cannot be found
// is fatal rather than a blank cell, for the usual reason: a short table looks
// complete.
const URLPARAMS = 'website/docs/urlparams.md'

export interface LaunchViewRow {
  /** the extension point id, `LaunchView-` plus the view type */
  id: string
  /** heading text of that view type's section on the URL parameters page */
  section: string
  /** anchor slug for the same heading */
  anchor: string
  /** the `Launch*Args` type the registry entry names */
  argsType: string
  /** repo-relative path the args type is exported from */
  argsFile: string
}

// GitHub's own heading slug, which is what the anchors on the rendered page
// are: lowercase, non-word characters dropped, spaces to hyphens.
function slugify(heading: string) {
  return heading
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-')
}

/** viewType -> the `###` heading its `SPEC_KEYS` block sits under. */
function specKeySections() {
  const lines = fs.readFileSync(URLPARAMS, 'utf8').split('\n')
  const sections = new Map<string, string>()
  let heading = ''
  for (const line of lines) {
    // level 3 only: each view type's section is a `###`, and the `####` under
    // it ("<view> properties") is where the marker actually sits
    const h = /^### (.+)$/.exec(line)
    if (h) {
      heading = h[1]!.trim()
    }
    const marker = /^<!-- SPEC_KEYS (\w+) START -->$/.exec(line)
    if (marker && heading) {
      sections.set(marker[1]!, heading)
    }
  }
  return sections
}

/** `Launch*Args` name -> the repo-relative file exporting it. */
function argsTypeFiles(corpus: SourceCorpus) {
  const files = new Map<string, string>()
  for (const file of corpus.files) {
    for (const m of corpus
      .read(file)
      .matchAll(/^export (?:interface|type) (Launch\w*Args)\b/gm)) {
      files.set(
        m[1]!,
        file.replace(/^.*?(?=(?:plugins|packages|products)\/)/, ''),
      )
    }
  }
  return files
}

export function collectLaunchViews(corpus: SourceCorpus): LaunchViewRow[] {
  const { launchArgs } = scanSpecKeys(corpus)
  const sections = specKeySections()
  const files = argsTypeFiles(corpus)

  const noSection: string[] = []
  const noArgsFile: string[] = []
  const rows = [...launchArgs]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([viewType, argsType]) => {
      const section = sections.get(viewType)
      const argsFile = files.get(argsType)
      if (!section) {
        noSection.push(viewType)
      }
      if (!argsFile) {
        noArgsFile.push(`${viewType} (${argsType})`)
      }
      return {
        id: `LaunchView-${viewType}`,
        section: section ?? '',
        anchor: section ? slugify(section) : '',
        argsType,
        argsFile: argsFile ?? '',
      }
    })

  if (noSection.length > 0) {
    throw new Error(
      `these launchable view types have no \`<!-- SPEC_KEYS <type> START -->\` block under a \`###\` heading in ${URLPARAMS}, so the extension-points guide has no section to link their spec fields to: ${noSection.join(', ')}`,
    )
  }
  if (noArgsFile.length > 0) {
    throw new Error(
      `the args type each of these registry entries names is exported from nowhere the scan can see, so the extension-points guide would link nothing: ${noArgsFile.join(', ')}`,
    )
  }
  return rows
}

export function writeLaunchViewDocs(
  corpus: SourceCorpus,
  { check = false } = {},
) {
  const rows = collectLaunchViews(corpus)
  return rewriteMarkerBlock(
    'LAUNCH_VIEW_POINTS',
    markdownTable(
      ['Extension point', 'Spec fields', 'Args type'],
      rows.map(
        r =>
          // link text is the heading verbatim, so the two pages call the
          // section the same thing without anyone keeping them in step
          `| \`${tableCell(r.id)}\` | [${tableCell(r.section)}](/docs/urlparams#${r.anchor}) | [\`${tableCell(r.argsType)}\`](https://github.com/GMOD/jbrowse-components/blob/main/${r.argsFile}) |`,
      ),
    ),
    { check },
  )
}
