// Shape of the generated config manifest (configManifest.generated.ts), which
// scripts/generateConfigManifest.ts reads out of the live ConfigurationSchema
// objects. Declared here rather than inferred from the generated file so the
// generator and the validator agree on a contract, and a generator change that
// drops a field is a type error rather than a silent behaviour change.

export interface SlotEntry {
  name: string
  /** MST's own name for the slot type, e.g. `(JexlString | number)` */
  type: string
  /** present when the slot is a nested sub-schema (adapter.index and friends) */
  subSlots?: SlotEntry[]
}

export interface TypeEntry {
  slots: SlotEntry[]
  /**
   * Keys no current schema declares but that this schema's own
   * preProcessSnapshot lifts into current slots. A config using one loads
   * correctly, so these are reported as stale rather than wrong.
   */
  legacyKeys?: string[]
  /**
   * Adapters only: keys `normalizeSnapshot` expands, so `{type, uri}` is valid
   * even though the schema declares `bamLocation`.
   */
  shorthandKeys?: string[]
  /** Tracks only: the display types this track offers. */
  displayTypes?: string[]
  /** Old type names this type still answers to. */
  aliases?: string[]
  /**
   * Displays only: the MST properties of the display's state model — what a
   * display node inside a saved session (or a `defaultSession`) may carry. A
   * config slot is NOT among them: the session snapshot instantiates the state
   * model, which drops a key it does not declare.
   */
  stateModelProps?: string[]
}

export type TypeGroup = Record<string, TypeEntry>

export interface ConfigManifest {
  adapters: TypeGroup
  tracks: TypeGroup
  displays: TypeGroup
  textSearchAdapters: TypeGroup
  connections: TypeGroup
  /**
   * Legacy display-instance keys product-core's sessionMigrations still lifts
   * onto the config slots that replaced them, keyed by the display type they
   * apply to (`*` = any). A session carrying one loads correctly, so it is
   * reported as stale rather than as a dead setting.
   */
  migratedDisplayKeys: Record<string, string[]>
}

export type ProblemLevel = 'error' | 'warning'

export interface Problem {
  level: ProblemLevel
  /** JSON-ish path into the config, e.g. `tracks[3].adapter.bamLocation` */
  where: string
  message: string
}

export interface ValidationResult {
  problems: Problem[]
  notes: string[]
  errorCount: number
  warningCount: number
}
