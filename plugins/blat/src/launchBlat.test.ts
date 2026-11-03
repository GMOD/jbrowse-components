import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import {
  clickMenuItem,
  createRpcTestEnvironment,
  menuSubItems,
} from '../../alignments/src/LinearAlignmentsDisplay/testUtils.ts'
import { addBlatMenuItems } from './launchBlat.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function labels(items: MenuItem[]) {
  return items.map(item => ('label' in item ? item.label : undefined))
}

function launchItem(items: MenuItem[], label: string) {
  return menuSubItems(items, 'Launch').find(
    item => 'label' in item && item.label === label,
  )
}

function readFeature(fields: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'read1',
    refName: 'ctgA',
    start: 100,
    end: 150,
    name: 'read1',
    ...fields,
  })
}

const LEFT_CLIP = 'C'.repeat(25)
const ALIGNED = 'A'.repeat(50)

test('a clipped read offers BLAT of the read and of its clips', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: addBlatMenuItems,
  })
  const { session, display } = createDisplay()
  display.setContextMenuFeature(
    readFeature({ seq: LEFT_CLIP + ALIGNED, CIGAR: '25S50M' }),
  )

  const items = display.contextMenuItems()
  expect(labels(menuSubItems(items, 'Launch'))).toEqual(
    expect.arrayContaining(['BLAT read', 'BLAT soft-clipped bases']),
  )

  clickMenuItem(items, 'BLAT soft-clipped bases')
  expect(session.queuedDialogs[0]).toMatchObject({
    initialSequence: `>read1_left_clip\n${LEFT_CLIP}`,
    initialAssembly: 'volvox',
  })

  clickMenuItem(items, 'BLAT read')
  expect(session.queuedDialogs[1]).toMatchObject({
    initialSequence: `>read1\n${LEFT_CLIP}${ALIGNED}`,
  })
})

test('an unclipped read offers only the read', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: addBlatMenuItems,
  })
  const { display } = createDisplay()
  display.setContextMenuFeature(readFeature({ seq: ALIGNED, CIGAR: '50M' }))
  const launch = labels(menuSubItems(display.contextMenuItems(), 'Launch'))
  expect(launch).toContain('BLAT read')
  expect(launch).not.toContain('BLAT soft-clipped bases')
})

// the menu opens on the read id and the feature lands an RPC later, which
// rebuilds the menu; until then there are no bases to search
test('nothing is offered before the read has been fetched', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: addBlatMenuItems,
  })
  const { display } = createDisplay()
  expect(
    labels(menuSubItems(display.contextMenuItems(), 'Launch')),
  ).not.toContain('BLAT read')
})

test('a read longer than UCSC takes is shown disabled, saying why', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: addBlatMenuItems,
  })
  const { display } = createDisplay()
  display.setContextMenuFeature(
    readFeature({ seq: 'A'.repeat(30_000), CIGAR: '30000M' }),
  )
  expect(launchItem(display.contextMenuItems(), 'BLAT read')).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('25,000 bp per sequence'),
  })
})

// The view type registered the way a host registers it, since a view menu
// contribution extends the registered type, not a model built from the factory
function createView() {
  const pluginManager = new PluginManager()
  addBlatMenuItems(pluginManager)
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearGenomeView',
        stateModel: linearGenomeViewStateModelFactory(pluginManager),
        ReactComponent: () => null,
      }),
  )
  pluginManager.createPluggableElements()
  const assembly = { initialized: true, regions: [] }
  const { view } = types
    .model({
      view: pluginManager.getViewType('LinearGenomeView').stateModel,
      configuration: types.frozen({}),
    })
    .volatile(() => ({
      rpcManager: {},
      assemblyManager: {
        get: () => assembly,
        waitForAssembly: () => Promise.resolve(assembly),
      },
    }))
    .create({ view: { type: 'LinearGenomeView' } }, { pluginManager })
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
  ])
  return view
}

function blatSelection(items: MenuItem[]) {
  return items.find(item => 'label' in item && item.label === 'BLAT selection')
}

test('a rubberband selection offers BLAT, disabled past the UCSC limit', () => {
  const view = createView()
  view.zoomTo(10)
  view.setOffsets(view.pxToBp(100), view.pxToBp(200))
  expect(blatSelection(view.rubberBandLaunchMenuItems())).toMatchObject({
    disabled: false,
  })

  view.zoomTo(100)
  view.setOffsets(view.pxToBp(100), view.pxToBp(600))
  expect(blatSelection(view.rubberBandLaunchMenuItems())).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('25,000 bp per sequence'),
  })
})
