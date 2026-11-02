import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'

/** @deprecated moved to `@jbrowse/display-kit/rowAxisConfigSchema` */
export { rowAxisConfigSchema } from '@jbrowse/display-kit/rowAxisConfigSchema'

// `rows` typed as `Rows`, whose axis has `grid`; MAF's has none, so a mixin
// read of `rows.axis.grid` would be undefined there. `grid` stays a read of
// the displays that draw it.
export type TreeSidebarConfigModel = ConfigModelForFields<{
  rows: typeof rowsConfigSchema
}>
