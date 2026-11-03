import {
  agentPage,
  exampleBlock,
  firstParagraph,
  flatCode,
  memberLine,
  pluginOf,
} from './agentText.ts'
import { shorthandKeysByAdapter } from './configManifest.ts'
import {
  isBaseSchema,
  isNamedType,
  pageCategory,
  pageSlotGroups,
  relatedTrackType,
  slotTypeText,
  unionNesting,
} from './generateConfigDocs.ts'

import type { ConfigWithHeader } from './configTypes.ts'
import type { DisplayLinkContext, SlotRecord } from './generateConfigDocs.ts'

// Where the slots of this config are written, as one plain sentence — the
// website's slotNesting with its links and its base-schema redirect removed.
const AGENT_SLOT_NESTING: Record<string, (name: string) => string> = {
  Adapter: name =>
    `Slots go inside a track's adapter: "adapter": { "type": "${name}", ... }.`,
  Display: name =>
    `Slots go on a display entry: "displays": [{ "type": "${name}", ... }], or in the track's displayDefaults.`,
  Track: () =>
    'Slots are top-level fields of the track config, beside trackId and name.',
  Connection: () =>
    "Slots are top-level fields of the connection's entry in connections.",
  'Internet Account': () =>
    "Slots are top-level fields of the account's entry in internetAccounts.",
}

export function agentSlotLine(record: SlotRecord) {
  const type = slotTypeText(record, {
    declared: type => type,
    kind: name => name,
    code: code => flatCode(code),
  })
  const docs = [
    firstParagraph(record.docs),
    record.contextVariable.length &&
      `callback args: ${record.contextVariable.join(', ')}`,
    record.advanced && 'advanced',
  ]
    .filter(Boolean)
    .join(' — ')
  return memberLine(record.name, type && `: ${type}`, docs)
}

export function renderAgentConfig(
  cfg: ConfigWithHeader,
  bases: ConfigWithHeader[],
  links: DisplayLinkContext,
) {
  const { header, slots, filename } = cfg
  const category = pageCategory(header, links)
  const isBase = isBaseSchema(header, links)
  const records = pageSlotGroups(header.name, slots, bases).flatMap(
    g => g.records,
  )
  const trackType = relatedTrackType(header.name, links)
  const adapters = trackType ? (links.adaptersByTrack.get(trackType) ?? []) : []
  const displays = links.displayTypesByTrack.get(header.name) ?? []
  const shorthand =
    category === 'Adapter' && !isBase
      ? (shorthandKeysByAdapter()[header.name]?.shorthandKeys ?? [])
      : []
  return {
    category,
    text: agentPage(
      `${header.name} (${category} config, ${pluginOf(filename)})`,
      [
        firstParagraph(header.docs, 600),
        isBase
          ? `A shared base schema, not a type you write: use one of ${(links.extendedBy.get(header.name) ?? []).join(', ')}.`
          : header.union
            ? unionNesting(header.name, slots).replaceAll('`', '')
            : isNamedType(header.name, category, links) &&
              AGENT_SLOT_NESTING[category]?.(header.name),
        shorthand.length > 0 &&
          `Shorthand: ${shorthand.join(', ')} may replace the location slot.`,
        trackType && trackType !== header.name && `Track type: ${trackType}.`,
        adapters.length > 0 &&
          category !== 'Adapter' &&
          `Adapters: ${adapters.join(', ')}.`,
        displays.length > 0 && `Displays: ${displays.join(', ')}.`,
        links.modelNames.has(header.name) &&
          `Runtime API: docs topic "model:${header.name}".`,
        ...header.gotchas.map(g => `Note: ${firstParagraph(g, 600)}`),
        exampleBlock(header.examples[0]?.content),
      ],
      [{ heading: 'Slots', lines: records.map(r => agentSlotLine(r)) }],
    ),
  }
}
