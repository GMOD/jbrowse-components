import { types } from 'mobx-state-tree'
import { ElementId } from '../../util/types/mst'

export const HelloWorldMenuBarModelFactory = pluginManager =>
  types.model('HelloWorldMenuBar', {
    id: ElementId,
    type: types.literal('HelloWorldMenuBar'),
  })

export const HelloWorldWidgetModelFactory = pluginManager =>
  types.model('HelloWorldWidget', {
    id: ElementId,
    type: types.literal('HelloWorldWidget'),
  })
