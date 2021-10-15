import { AbstractRootModel } from '@jbrowse/core/util/types'

export interface DesktopRootModel extends AbstractRootModel {
  setSaved(): void
  setUnsaved(): void
}
