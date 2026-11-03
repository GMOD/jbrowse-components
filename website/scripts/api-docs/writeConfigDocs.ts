import { assertExamplesValidate } from './configExamples.ts'
import { writePage } from './format.ts'
import {
  adaptersMissingTrackType,
  assertManifestSlotsAreDocumented,
  assertNoBlankSlotDescriptions,
  collectBaseConfigs,
  configCategory,
  extendedByMap,
  isBaseSchema,
  linkedConfigs,
  renderAgentConfig,
  renderConfig,
  slotsMissingDescription,
  stripNameTautology,
  unresolvedBases,
} from './generateConfigDocs.ts'
import { assertUniquePages, headerGaps } from './util.ts'

import type { Config, ConfigWithHeader } from './configTypes.ts'
import type { DisplayLinkContext } from './generateConfigDocs.ts'

// Group every documented adapter by the track type it declares via #trackType,
// so a track/display page can list the adapters that supply it.
//
// Sorted, because the input order is a source scan and the output is a committed
// page. Unsorted, the "Related links" block on a track page reorders whenever
// the scan does — an unrelated new export in a plugin's `index.ts` was enough —
// and the diff flips back and forth with nothing behind it. No page's list was
// in a meaningful order to lose: they were grouped by declaring adapter, which
// says nothing about which format a reader should reach for first.
function adaptersByTrackType(configs: ConfigWithHeader[]) {
  const map = new Map<string, string[]>()
  for (const config of configs) {
    const trackType = config.header.trackType
    if (trackType) {
      map.set(trackType, [...(map.get(trackType) ?? []), config.header.name])
    }
  }
  for (const names of map.values()) {
    names.sort((a, b) => a.localeCompare(b, 'en'))
  }
  return map
}

export function writeConfigDocs(
  byFile: Record<string, Config>,
  displayTypesByTrack: Map<string, string[]>,
  displayToTrackType: Map<string, string>,
  modelNames: Set<string>,
) {
  const dir = 'website/docs/config'
  const { withHeader, index } = linkedConfigs(byFile)
  const { byName } = index
  // All before the write loop, so a run that would emit a blank cell, drop a
  // slot, or write one page for two types fails without having rewritten
  // anything.
  assertNoBlankSlotDescriptions(slotsMissingDescription(withHeader))
  assertExamplesValidate(withHeader, displayTypesByTrack)
  assertManifestSlotsAreDocumented(withHeader, index)
  assertUniquePages(
    '#config',
    withHeader.map(c => ({
      name: c.header.name,
      slug: c.header.id,
      filename: c.filename,
    })),
  )
  const extendedBy = extendedByMap(withHeader, index)
  const links: DisplayLinkContext = {
    displayTypesByTrack,
    displayToTrackType,
    adaptersByTrack: adaptersByTrackType(withHeader),
    byName,
    modelNames,
    extendedBy,
  }
  const agentPages: Record<string, { category: string; text: string }> = {}
  for (const cfg of withHeader) {
    const bases = collectBaseConfigs(cfg, index)
    writePage(`${dir}/${cfg.header.name}.md`, renderConfig(cfg, bases, links))
    agentPages[cfg.header.name] = renderAgentConfig(cfg, bases, links)
  }
  // A base/shared schema is exempt from the #example gap: it is never named in
  // a config, so an example on it would teach a type nobody can write. Listing
  // them made the list a 40-name wall that read as noise, which is how ~17
  // genuinely pasteable adapters and displays stayed bare. Their route to a
  // usable shape is the Extended by links, not an example of their own.
  //
  // isBaseSchema, not a bare `extendedBy.has()`: a config that others derive
  // from but that *is* itself writable — it carries a DisplayType registration —
  // is a real gap, and exempting it would hide the one thing this list exists to
  // surface.
  return {
    agentPages,
    ...headerGaps({
      items: withHeader,
      getName: c => c.header.name,
      getDocs: c => stripNameTautology(c.header.docs, c.header.name),
      hasExample: c => c.header.examples.length > 0,
      // Was a filter on `items`, which also dropped these from the General gap —
      // a base schema that fell out of every category is still a real gap, and
      // that one was silently unreportable. Zero either way today; see the
      // headerGaps comment.
      wantsExample: c => !isBaseSchema(c.header, links),
      isGeneralCategory: c =>
        configCategory(c.header.name, c.header.category) === 'General',
    }),
    unresolvedBase: unresolvedBases(withHeader, index),
    adapterNoTrackType: adaptersMissingTrackType(withHeader),
  }
}
