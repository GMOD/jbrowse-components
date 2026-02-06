import {
  clickViewMenuOption,
  copyView,
  delay,
  findByText,
  navigateToApp,
  navigateWithSessionSpec,
  setupWorkspacesViaMoveToTab,
  waitForLoadingToComplete,
  waitForWorkspacesReady,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Workspaces',
  tests: [
    {
      name: 'can add Linear genome view from menu with workspaces enabled',
      fn: async page => {
        await navigateToApp(page)

        const toolsMenu = await findByText(page, 'Tools', 10000)
        await toolsMenu?.click()
        await delay(300)
        const useWorkspacesCheckbox = await findByText(
          page,
          'Use workspaces',
          10000,
        )
        await useWorkspacesCheckbox?.click()
        await delay(500)

        const searchInputsBefore = await page.$$(
          'input[placeholder="Search for location"]',
        )
        const viewCountBefore = searchInputsBefore.length

        const addMenu = await findByText(page, 'Add', 10000)
        await addMenu?.click()
        await delay(300)
        const linearGenomeViewOption = await findByText(
          page,
          'Linear genome view',
          10000,
        )
        await linearGenomeViewOption?.click()

        const timeout = 10000
        const start = Date.now()
        let viewCountAfter = viewCountBefore
        while (Date.now() - start < timeout) {
          const searchInputsAfter = await page.$$(
            'input[placeholder="Search for location"]',
          )
          viewCountAfter = searchInputsAfter.length
          if (viewCountAfter > viewCountBefore) {
            break
          }
          await delay(200)
        }

        if (viewCountAfter <= viewCountBefore) {
          throw new Error(
            `New Linear genome view was not added. Views before: ${viewCountBefore}, after: ${viewCountAfter}`,
          )
        }

        await waitForLoadingToComplete(page)
        await snapshot(page, 'workspaces-add-view', 0.2)
      },
    },
    {
      name: 'move to new tab enables workspaces',
      fn: async page => {
        await navigateToApp(page)
        await setupWorkspacesViaMoveToTab(page)
        await snapshot(page, 'workspaces-new-tab', 0.2)
      },
    },
    {
      name: 'move to split right enables workspaces',
      fn: async page => {
        await navigateToApp(page)
        await copyView(page)
        await clickViewMenuOption(page, 'Move to split view', 0)
        await waitForWorkspacesReady(page)
        await snapshot(page, 'workspaces-split-view', 0.2)
      },
    },
    {
      name: 'copy view creates second view',
      fn: async page => {
        await navigateToApp(page)
        await copyView(page)
        const viewMenus = await page.$$('[data-testid="view_menu_icon"]')
        if (viewMenus.length !== 2) {
          throw new Error(`Expected 2 views, got ${viewMenus.length}`)
        }
      },
    },
    {
      name: 'layout URL param creates workspaces with horizontal split',
      fn: async page => {
        const sessionSpec = {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-5000',
            },
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:5000-10000',
            },
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgB:1-5000',
            },
          ],
          layout: {
            direction: 'horizontal',
            children: [{ views: [0, 1] }, { views: [2] }],
          },
        }

        await navigateWithSessionSpec(page, sessionSpec)

        await page.waitForSelector(
          '.dockview-theme-light, .dockview-theme-dark',
          { timeout: 10000 },
        )
        await delay(2000)

        const groups = await page.$$('.dv-groupview')
        if (groups.length < 2) {
          throw new Error(
            `Expected at least 2 dockview groups for horizontal split, got ${groups.length}`,
          )
        }

        let viewContainers: Awaited<ReturnType<typeof page.$$>> = []
        for (let i = 0; i < 20; i++) {
          viewContainers = await page.$$('[data-testid^="view-container-"]')
          if (viewContainers.length >= 3) {
            break
          }
          await delay(500)
        }

        if (viewContainers.length < 3) {
          throw new Error(
            `Expected 3 view containers total, got ${viewContainers.length}`,
          )
        }

        await waitForLoadingToComplete(page)
        await snapshot(page, 'workspaces-layout-url-param', 0.2)
      },
    },
    {
      name: 'layout URL param with custom sizes',
      fn: async page => {
        const sessionSpec = {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-5000',
            },
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgB:1-5000',
            },
          ],
          layout: {
            direction: 'horizontal',
            children: [
              { views: [0], size: 70 },
              { views: [1], size: 30 },
            ],
          },
        }

        await navigateWithSessionSpec(page, sessionSpec)

        await page.waitForSelector(
          '.dockview-theme-light, .dockview-theme-dark',
          { timeout: 10000 },
        )
        await delay(2000)

        const groups = await page.$$('.dv-groupview')
        if (groups.length < 2) {
          throw new Error(`Expected 2 dockview groups, got ${groups.length}`)
        }

        const viewContainers = await page.$$(
          '[data-testid^="view-container-"]',
        )
        if (viewContainers.length !== 2) {
          throw new Error(
            `Expected 2 view containers, got ${viewContainers.length}`,
          )
        }

        await waitForLoadingToComplete(page)
        await snapshot(page, 'workspaces-layout-custom-sizes', 0.2)
      },
    },
    {
      name: 'multiple views in workspace - move up and down',
      fn: async page => {
        await navigateToApp(page)
        await setupWorkspacesViaMoveToTab(page)

        await copyView(page)

        const getViewOrder = () =>
          page.evaluate(() => {
            const containers = document.querySelectorAll(
              '[data-testid^="view-container-"]',
            )
            return [...containers].map(c => (c as HTMLElement).dataset.testid)
          })

        const orderBefore = await getViewOrder()
        if (orderBefore.length < 2) {
          throw new Error(
            `Expected at least 2 view containers, got ${orderBefore.length}`,
          )
        }

        await clickViewMenuOption(page, 'Move view down', 0)
        await delay(500)

        const orderAfter = await getViewOrder()
        if (
          orderBefore[0] === orderAfter[0] &&
          orderBefore[1] === orderAfter[1]
        ) {
          throw new Error(
            `View order did not change after move down. Before: ${orderBefore.join(', ')}. After: ${orderAfter.join(', ')}`,
          )
        }
      },
    },
  ],
}

export default suite
