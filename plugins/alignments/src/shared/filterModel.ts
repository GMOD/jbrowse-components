import { types } from 'mobx-state-tree'

export const FilterModel = types.model({
  flagInclude: types.optional(types.number, 0),
  flagExclude: types.optional(types.number, 1540),
  readName: types.maybe(types.string),
  tagFilter: types.maybe(
    types.model({
      tag: types.string,
      value: types.maybe(types.string),
    }),
  ),
})

export interface IFilter {
  flagExclude: number
  flagInclude: number
  readName?: string
  tagFilter?: {
    tag: string
    value?: string
  }
}
