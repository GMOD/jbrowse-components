import { getConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

import bgzipMaf from '../BgzipMafAdapter/configSchema.ts'
import bgzipTaffy from '../BgzipTaffyAdapter/configSchema.ts'
import bigMaf from '../BigMafAdapter/configSchema.ts'
import mafTabix from '../MafTabixAdapter/configSchema.ts'

const SCHEMAS = {
  BgzipMafAdapter: bgzipMaf,
  BgzipTaffyAdapter: bgzipTaffy,
  BigMafAdapter: bigMaf,
  MafTabixAdapter: mafTabix,
}

function slot(schema: (typeof SCHEMAS)[keyof typeof SCHEMAS], name: string) {
  return getConfigurationSchemaDefinition(schema)?.[name] as
    | { type: string; defaultValue: unknown; description?: string }
    | undefined
}

const NAMES = Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[]

// The four slots `MafAdapterBase` reads. Each adapter used to spell them out
// itself, and two had drifted: both bgzip schemas' `samples` description
// stopped at `assemblyName` and never mentioned `assemblyConfigLocation`, which
// `normalizeSamples` honors on all four — so a `.maf.gz` track's config page
// said the field did not exist.
test.each(['samples', 'nhLocation', 'annotationAdapter'])(
  '%s is one table, not four',
  name => {
    const first = slot(SCHEMAS[NAMES[0]!], name)
    expect(first).toBeDefined()
    for (const adapter of NAMES.slice(1)) {
      expect(slot(SCHEMAS[adapter], name)).toEqual(first)
    }
  },
)

test('the samples description names both navigation fields', () => {
  for (const adapter of NAMES) {
    expect(slot(SCHEMAS[adapter], 'samples')?.description).toContain(
      'assemblyConfigLocation',
    )
  }
})

// The one slot whose prose is genuinely per format — what a zoom-out read costs
// depends on the file it reads — so only its shape is shared.
test('summaryAdapter keeps its type and default across the four', () => {
  for (const adapter of NAMES) {
    expect(slot(SCHEMAS[adapter], 'summaryAdapter')).toMatchObject({
      type: 'frozen',
      defaultValue: null,
    })
  }
})
