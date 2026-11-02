import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import type { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'

/** @deprecated moved to `@jbrowse/display-kit/rowAxisConfigSchema` */
export { rowAxisConfigSchema } from '@jbrowse/display-kit/rowAxisConfigSchema'

export type TreeSidebarConfigModel = ConfigModelForFields<{
  rows: typeof rowsConfigSchema
  rowColor: typeof rowColorConfigSchema
}>
