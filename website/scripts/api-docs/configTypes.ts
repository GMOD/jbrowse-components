import type { ReachedSchema } from './docProgram.ts'
import type { Example } from './jsDocTags.ts'

export interface Item {
  name: string
  docs: string
  examples: Example[]
  category?: string
  code: string
  // a sub-schema slot's schema: the declIds its value expression names, and the
  // `#config` page the nearest of them resolves to once every config is read
  schemaDeclIds?: string[]
  schemaPage?: { name: string; id: string }
  schemas?: ReachedSchema[]
  returnedCode?: string
  // a sub-schema slot whose own slots are rows of this page, or of `page`: the
  // schema's name, whether the slot holds a list of them, and the first of
  // those rows
  subSchema?: {
    name?: string
    list: boolean
    firstSlot: string
    page?: string
  }
  // the slot's default is a parameter of the factory declaring it, so the
  // column names the arrangement rather than one caller's value
  parameterisedDefault?: boolean
  // a slot a spread's JSDoc documents: the row the spread gives it undocumented
  spreadSlot?: string
}
export interface ConfigHeader {
  name: string
  docs: string
  examples: Example[]
  // `#gotcha` blocks, rendered as caution callouts under the example
  gotchas: string[]
  id: string
  // "file:pos" identity of the declaration this #config sits on. A deriving
  // config's `baseConfiguration:` slot resolves (alias-followed) to this same
  // id, so it's how we link the derivation graph.
  declId?: string
  // explicit #category tag value, e.g. "assemblyManagement" — wins over the
  // name-suffix heuristic in configCategory() when present
  category?: string
  // explicit #trackType tag value, e.g. "AlignmentsTrack" — the track type an
  // adapter's example is wrapped in to show a full track config (see
  // wrapAdapterExample). Adapter pages only.
  trackType?: string
  // the #config sits on a `ConfigurationSchemaUnion`, whose rows are each
  // prefixed with the member type they belong to
  union?: boolean
  // the name the documented `ConfigurationSchema(...)` call gives its schema,
  // which is how the manifest names a sub-schema it nests under a slot
  schemaName?: string
}
export interface Config {
  header?: ConfigHeader
  derives?: Item
  // declId the `baseConfiguration:` expression resolves to (the base config)
  baseDeclId?: string
  // config-name fallback for dynamic base references (getDisplayType('Name'))
  baseConfigName?: string
  identifier?: Item
  slots: Item[]
  // slots pulled in by spreading a shared slot table, folded into `slots` by
  // mergeSpreadSlots once accumulation is done (see spreadSlots)
  spreadSlots?: Item[]
  filename: string
}
export type ConfigWithHeader = Config & { header: ConfigHeader }
export interface ConfigIndex {
  byDeclId: Map<string, ConfigWithHeader>
  byName: Map<string, ConfigWithHeader>
}
