import rpcConfigSchema from '../rpc/configSchema.ts'
import { FormatAboutConfigSchemaFactory } from './formatAboutConfigSchema.ts'
import { FormatDetailsConfigSchemaFactory } from './formatDetailsConfigSchema.ts'
import { HierarchicalConfigSchemaFactory } from './hierarchicalConfigSchema.ts'
import { PreferencesConfigSchemaFactory } from './preferencesConfigSchema.ts'

/**
 * The root config slots every product declares, which core reads through
 * `session.configuration`. Each product's root schema spreads or restates
 * them; a plugin's own namespace sits beside them, untyped.
 */
export function rootConfigSchemaFields() {
  return {
    rpc: rpcConfigSchema,
    hierarchical: HierarchicalConfigSchemaFactory(),
    preferences: PreferencesConfigSchemaFactory(),
    formatDetails: FormatDetailsConfigSchemaFactory(),
    formatAbout: FormatAboutConfigSchemaFactory(),
    theme: { type: 'frozen', defaultValue: {} },
  } as const
}
