import { Instance } from 'mobx-state-tree'
import { BaseRootModel as BaseRootModelF } from './Base'

export { BaseRootModel } from './Base'
export type RootModel = Instance<ReturnType<typeof BaseRootModelF>>
