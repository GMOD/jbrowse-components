import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'
import MainMenuBarModel, { MenuItemModel } from './model'

jest.mock('file-saver')

test('can export configuration', () => {
  const sessionSchema = types.model({
    name: 'testSession',
    configuration: ConfigurationSchema('Toaster', {
      foo: { type: 'number', defaultValue: 42 },
    }),
    item: MenuItemModel,
  })

  const model = sessionSchema.create({
    item: {
      name: 'export',
      callback: 'exportConfiguration',
    },
    configuration: {
      foo: 99,
    },
  })

  const jsonString = model.item.func()
  expect(jsonString).toContain('"foo": 99')
})

test('can push menus', () => {
  const menubar = MainMenuBarModel.create({ type: 'MainMenuBar' })
  menubar.pushMenu({
    name: 'Admin',
    menuItems: [
      {
        name: 'Export configuration',
        icon: 'cloud_download',
        callback: 'export',
      },
    ],
  })

  expect(menubar.menus.length).toBe(3)
  expect(menubar.menus.map(m => m.name)).toEqual(['File', 'Help', 'Admin'])
})

test('can unshift menus', () => {
  const menubar = MainMenuBarModel.create({ type: 'MainMenuBar' })
  menubar.unshiftMenu({
    name: 'Admin',
    menuItems: [
      {
        name: 'Export configuration',
        icon: 'cloud_download',
        callback: 'exportConfiguration',
      },
    ],
  })

  expect(menubar.menus.length).toBe(3)
  expect(menubar.menus.map(m => m.name)).toEqual(['Admin', 'File', 'Help'])
})
