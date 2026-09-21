import { cast, types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from '../../configuration/index.ts'
import { filterByValueItems, jexlFilterDisplay } from './jexlFilterActions.ts'

import type { MenuItem } from '../../ui/MenuTypes.ts'
import type { SnackAction } from '../../util/types/services.ts'

const CONFIGURED = ["jexl:feature.FILTER == 'PASS'"]

function setup() {
  const notify = jest.fn<undefined, [string, string, SnackAction]>()
  const session = types
    .model('Session', {
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      track: types.model('Track', {
        displays: types.array(
          types
            .model('Display', {
              jexlFiltersSetting: types.maybe(types.array(types.string)),
            })
            .views(() => ({
              configuredFilters: () => CONFIGURED,
            }))
            .actions(self => ({
              setJexlFilters(filters?: string[]) {
                self.jexlFiltersSetting = cast(filters)
              },
            })),
        ),
      }),
    })
    .actions(() => ({ notify }))
    .create({ track: { displays: [{}] } })
  const display = jexlFilterDisplay(session.track)!
  return { display, notify }
}

function click(item: MenuItem | undefined) {
  if (item && 'onClick' in item) {
    item.onClick()
  }
}

test('a number gets show, hide and at-least items', () => {
  const { display } = setup()
  const items = filterByValueItems(display, ['INFO', 'DP'], 30)
  expect(items.map(item => 'label' in item && item.label)).toEqual([
    'Show only INFO.DP = 30',
    'Hide INFO.DP = 30',
    'Show only INFO.DP ≥ 30',
  ])
  click(items[2])
  expect(display.jexlFiltersSetting).toEqual([
    ...CONFIGURED,
    'jexl:feature.INFO.DP >= 30',
  ])
})

test('hiding text writes != with the key quoted where it has to be', () => {
  const { display } = setup()
  const items = filterByValueItems(display, ['INFO', 'CLN-SIG'], "it's")
  expect(items).toHaveLength(2)
  click(items[1])
  expect(display.jexlFiltersSetting).toEqual([
    ...CONFIGURED,
    "jexl:feature.INFO['CLN-SIG'] != 'it\\'s'",
  ])
})

test('undo restores the filters as they were', () => {
  const { display, notify } = setup()
  click(filterByValueItems(display, ['QUAL'], 5)[0])
  const [message, , action] = notify.mock.calls[0]!
  expect(message).toBe('Filter added')
  expect(action.name).toBe('Undo')
  action.onClick()
  expect(display.jexlFiltersSetting).toBeUndefined()
})

test('offers nothing for a value that is not text or a number', () => {
  const { display } = setup()
  expect(filterByValueItems(display, ['INFO', 'DB'], true)).toEqual([])
  expect(filterByValueItems(display, ['ALT'], ['A', 'T'])).toEqual([])
})
