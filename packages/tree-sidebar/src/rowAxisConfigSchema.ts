import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'

/** @deprecated moved to `@jbrowse/display-kit/rowAxisConfigSchema` */
export { rowAxisConfigSchema } from '@jbrowse/display-kit/rowAxisConfigSchema'

/**
 * The `rows` every display composing `TreeSidebarMixin` declares: MAF's
 * field-less `RowArrangement`, or a `Rows` adding `field`, `filter` and the
 * axis `grid` to it.
 */
export type TreeSidebarConfigModel = ConfigModelForFields<{
  rows: typeof rowArrangementConfigSchema
}>
