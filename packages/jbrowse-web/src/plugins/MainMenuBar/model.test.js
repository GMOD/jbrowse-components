import { types } from 'mobx-state-tree'
import { MenuItemModel } from './model'
import { ConfigurationSchema } from '../../configuration'

jest.mock('file-saver')

test('can download configuration', () => {
  const rootSchema = types.model({
    configuration: ConfigurationSchema('Toaster', {
      foo: { type: 'number', defaultValue: 42 },
    }),
    item: MenuItemModel,
  })

  const model = rootSchema.create({
    item: {
      name: 'doonlood',
      callback: 'downloadConfiguration',
    },
  })

  const jsonString = model.item.func()
  expect(jsonString).toContain('"configId"')
})
