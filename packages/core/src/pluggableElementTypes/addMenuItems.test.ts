import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { LAUNCH_LABEL } from '../ui/launchViewMenu.ts'
import ViewType from './ViewType.ts'
import { addViewMenuItems } from './addMenuItems.ts'

import type { MenuItem, SubMenuItem } from '../ui/MenuTypes.ts'
import type { AnyReactComponentType } from '../util/index.ts'

// Two menu methods, one of them taking an argument, so the arg-threading below
// is asserted against a real signature rather than an `any`.
const baseModel = types
  .model('TestView', {
    id: types.optional(types.identifier, 'v'),
    type: types.string,
  })
  .views(() => ({
    menuItems(): MenuItem[] {
      return [{ label: 'base', onClick: () => {} }]
    },
    highlightMenuItems(highlight: { name: string }): MenuItem[] {
      return [{ label: `base ${highlight.name}`, onClick: () => {} }]
    },
  }))

// A second type sharing `menuItems` and nothing else, so a contribution named
// against both is held to what they have in common.
const otherModel = types
  .model('TestOtherView', {
    id: types.optional(types.identifier, 'v'),
    type: types.string,
  })
  .views(() => ({
    menuItems(): MenuItem[] {
      return [{ label: 'other base', onClick: () => {} }]
    },
  }))

declare module '../PluginManager.ts' {
  interface ViewTypeRegistry {
    TestMenuView: typeof baseModel
    TestOtherView: typeof otherModel
    TestUnnamedView: typeof otherModel
  }
}

const ReactComponent = (() => null) as unknown as AnyReactComponentType

interface TestMenus {
  menuItems: () => MenuItem[]
  highlightMenuItems: (highlight: { name: string }) => MenuItem[]
}

function makeViews(pm: PluginManager) {
  pm.addViewType(
    () =>
      new ViewType({
        name: 'TestMenuView',
        stateModel: baseModel,
        ReactComponent,
      }),
  )
  for (const name of ['TestOtherView', 'TestUnnamedView'] as const) {
    pm.addViewType(
      () => new ViewType({ name, stateModel: otherModel, ReactComponent }),
    )
  }
  pm.createPluggableElements()
  const make = (name: string) =>
    pm
      .getViewType(name)
      .stateModel.create({ type: name }) as unknown as TestMenus
  return {
    view: make('TestMenuView'),
    other: make('TestOtherView'),
    unnamed: make('TestUnnamedView'),
  }
}

function makeView(pm: PluginManager) {
  return makeViews(pm).view
}

// a divider has no label, and none of these menus contain one
function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : '---'))
}

test('contributed items follow the ones already there', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'menuItems',
    items: () => ({ label: 'mine', onClick: () => {} }),
  })
  expect(labels(makeView(pm).menuItems())).toEqual(['base', 'mine'])
})

test('two plugins both contribute, in registration order', () => {
  const pm = new PluginManager([])
  for (const label of ['first', 'second']) {
    addViewMenuItems(pm, 'TestMenuView', {
      menu: 'menuItems',
      items: () => ({ label, onClick: () => {} }),
    })
  }
  expect(labels(makeView(pm).menuItems())).toEqual(['base', 'first', 'second'])
})

test('a contributor returning undefined adds nothing and drops nothing', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'menuItems',
    items: () => undefined,
  })
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'menuItems',
    items: () => ({ label: 'mine', onClick: () => {} }),
  })
  expect(labels(makeView(pm).menuItems())).toEqual(['base', 'mine'])
})

test('a contributor can return several items at once', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'menuItems',
    items: () => [
      { label: 'a', onClick: () => {} },
      { label: 'b', onClick: () => {} },
    ],
  })
  expect(labels(makeView(pm).menuItems())).toEqual(['base', 'a', 'b'])
})

// The reason `group` is the fold's job: two plugins naming it get one submenu
// between them, whichever ran first, instead of a top-level row each.
test('group collects both plugins items under one submenu', () => {
  const pm = new PluginManager([])
  for (const label of ['first', 'second']) {
    addViewMenuItems(pm, 'TestMenuView', {
      menu: 'menuItems',
      group: LAUNCH_LABEL,
      items: () => ({ label, onClick: () => {} }),
    })
  }
  const items = makeView(pm).menuItems()
  expect(labels(items)).toEqual(['base', LAUNCH_LABEL])
  expect(labels((items[1] as SubMenuItem).subMenu)).toEqual(['first', 'second'])
})

// A second call has to see a clean array: `group` reaches inside an item to
// push, so a fold handing back something it kept would grow the submenu on
// every menu open.
test('reopening the menu does not accumulate', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'menuItems',
    group: LAUNCH_LABEL,
    items: () => ({ label: 'mine', onClick: () => {} }),
  })
  const view = makeView(pm)
  view.menuItems()
  const items = view.menuItems()
  expect(labels((items[1] as SubMenuItem).subMenu)).toEqual(['mine'])
})

test('the menu methods own arguments reach the contributor', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    menu: 'highlightMenuItems',
    items: (_self, highlight) => ({
      label: `mine ${highlight.name}`,
      onClick: () => {},
    }),
  })
  expect(labels(makeView(pm).highlightMenuItems({ name: 'h1' }))).toEqual([
    'base h1',
    'mine h1',
  ])
})

// typecheck-only, the way accumulatingExtensionPoint.test.tsx asserts its
// guarantee: an unused @ts-expect-error fails `pnpm typecheck`. A contribution
// to a method the model does not have is exactly the failure this helper exists
// to convert into a compile error, since at runtime it is silent.
test('a method the model does not have is a compile error', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, 'TestMenuView', {
    // @ts-expect-error no such menu method on this view type
    menu: 'trackMenuItems',
    items: () => undefined,
  })
  expect(pm.extensionPointCallbackCount('Core-extendPluggableElement')).toBe(1)
})

// One registration, several types: the shape a contribution belonging to a
// family takes, since the tree spells a family as a shared mixin set rather
// than a chain there is no parent to name — `reference/REJECTED_IDEAS.md`,
// "Give a pluggable element an `extendsType`".
test('one call naming several types reaches each of them and nothing else', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, ['TestMenuView', 'TestOtherView'], {
    menu: 'menuItems',
    items: () => ({ label: 'mine', onClick: () => {} }),
  })
  const { view, other, unnamed } = makeViews(pm)
  expect(labels(view.menuItems())).toEqual(['base', 'mine'])
  expect(labels(other.menuItems())).toEqual(['other base', 'mine'])
  expect(labels(unnamed.menuItems())).toEqual(['other base'])
})

// typecheck-only, like the single-name case above. Naming several types hands
// the contributor a union, so `keyof` is what they share: a menu only one of
// them has would otherwise reach the others as a `self[menu]` that is
// undefined, which throws when that menu is opened rather than where it is
// written.
test('a menu only one of the named types has is a compile error', () => {
  const pm = new PluginManager([])
  addViewMenuItems(pm, ['TestMenuView', 'TestOtherView'], {
    // @ts-expect-error TestOtherView has no highlightMenuItems
    menu: 'highlightMenuItems',
    items: () => undefined,
  })
  expect(pm.extensionPointCallbackCount('Core-extendPluggableElement')).toBe(1)
})
