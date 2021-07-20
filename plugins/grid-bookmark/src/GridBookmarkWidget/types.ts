import { AbstractViewModel } from '@jbrowse/core/util/types'
import { Region } from '@jbrowse/core/util/types'

export interface NavigableViewModel extends AbstractViewModel {
  navToLocString: Function
}

export interface LabeledRegion extends Region {
  label: string
}
