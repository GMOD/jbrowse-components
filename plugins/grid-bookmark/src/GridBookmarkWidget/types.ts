import { AbstractViewModel, Region } from '@jbrowse/core/util/types'

export interface NavigableViewModel extends AbstractViewModel {
  navToLocString: Function
}

export interface LabeledRegion extends Region {
  label: string
}
