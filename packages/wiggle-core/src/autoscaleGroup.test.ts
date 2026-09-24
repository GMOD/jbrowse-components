import { types } from '@jbrowse/mobx-state-tree'

import { ScoreAxisMixin } from './ScoreAxisMixin.ts'
import { autoscaleWith } from './autoscaleGroup.ts'
import { makeAutoscaleGroupItem } from './scoreMenuItems.ts'

const Display = types
  .compose(
    ScoreAxisMixin(),
    types.model({
      own: types.frozen<[number, number] | undefined>(),
      group: types.maybe(types.string),
      max: types.maybe(types.number),
    }),
  )
  .views(self => ({
    get autoscaleRange() {
      return self.own
    },
    get autoscaleGroup() {
      return self.group
    },
    get manualMaxScore() {
      return self.max
    },
  }))
  .actions(self => ({
    setAutoscaleGroup(group?: string) {
      self.group = group
    },
  }))

const View = types
  .model({
    tracks: types.array(types.model({ displays: types.array(Display) })),
  })
  .views(() => ({
    get width() {
      return 800
    },
  }))
  .actions(() => ({ setWidth() {} }))

function view(
  ...displays: {
    own?: [number, number]
    group?: string
    max?: number
  }[]
) {
  return View.create({
    tracks: displays.map(d => ({ displays: [d] })),
  }).tracks.map(t => t.displays[0]!)
}

test('tracks naming one group autoscale to the span of all their data', () => {
  const [a, b, c] = view(
    { own: [0, 10], group: 'depth' },
    { own: [5, 40], group: 'depth' },
    { own: [0, 100] },
  )
  expect(a!.autoscaledDomain).toEqual([0, 40])
  expect(b!.autoscaledDomain).toEqual([0, 40])
  expect(c!.autoscaledDomain).toEqual([0, 100])
})

test("a pinned end stays the pinning track's, and the group unions ranges, not domains", () => {
  const [a, b] = view(
    { own: [0, 10], group: 'depth', max: 20 },
    { own: [5, 40], group: 'depth' },
  )
  expect(a!.autoscaledDomain).toEqual([0, 20])
  expect(b!.autoscaledDomain).toEqual([0, 40])
})

test('a track with nothing of its own to scale takes no domain from its group', () => {
  const [a, b] = view({ group: 'depth' }, { own: [5, 40], group: 'depth' })
  expect(a!.autoscaledDomain).toBeUndefined()
  expect(b!.autoscaledDomain).toEqual([0, 40])
})

test('two groups stay apart', () => {
  const [a, b] = view(
    { own: [0, 10], group: 'depth' },
    { own: [5, 40], group: 'signal' },
  )
  expect(a!.autoscaledDomain).toEqual([0, 10])
  expect(b!.autoscaledDomain).toEqual([0, 40])
})

function peer(autoscaleGroup?: string) {
  const p = {
    autoscaleGroup,
    autoscaleRange: undefined,
    setAutoscaleGroup(group?: string) {
      p.autoscaleGroup = group
    },
  }
  return p
}

test('ticking tracks with no group names one no track in the view holds', () => {
  const self = peer()
  const [a, b, c] = [peer(), peer('group1'), peer()]
  autoscaleWith(self, [a, b, c], new Set([a]))
  expect([self, a, b, c].map(p => p.autoscaleGroup)).toEqual([
    'group2',
    'group2',
    'group1',
    undefined,
  ])
})

test('re-ticking keeps the group, and an unticked member leaves it', () => {
  const self = peer('depth')
  const [a, b] = [peer('depth'), peer('depth')]
  autoscaleWith(self, [a, b], new Set([a]))
  expect([self, a, b].map(p => p.autoscaleGroup)).toEqual([
    'depth',
    'depth',
    undefined,
  ])
})

test('ticking nobody takes this track out and leaves the rest together', () => {
  const self = peer('depth')
  const [a, b] = [peer('depth'), peer('depth')]
  autoscaleWith(self, [a, b], new Set())
  expect([self, a, b].map(p => p.autoscaleGroup)).toEqual([
    undefined,
    'depth',
    'depth',
  ])
})

test("a track joins a ticked track's group where it has none", () => {
  const self = peer()
  const [a, b] = [peer('depth'), peer('depth')]
  autoscaleWith(self, [a, b], new Set([a]))
  expect([self, a, b].map(p => p.autoscaleGroup)).toEqual([
    'depth',
    'depth',
    'depth',
  ])
})

test("the menu row counts the other tracks in this track's group", () => {
  const [a, , c] = view(
    { own: [0, 10], group: 'depth' },
    { own: [5, 40], group: 'depth' },
    { own: [0, 100] },
  )
  expect(makeAutoscaleGroupItem(a!)).toMatchObject({
    label: 'Autoscale with other tracks (1)...',
  })
  expect(makeAutoscaleGroupItem(c!)).toMatchObject({
    label: 'Autoscale with other tracks...',
  })
})
