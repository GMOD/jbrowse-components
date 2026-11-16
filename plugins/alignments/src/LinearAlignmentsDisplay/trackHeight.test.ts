import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(displayConfig: Record<string, unknown> = {}) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

function reloaded(display: ReturnType<typeof createDisplay>) {
  return createDisplay(getSnapshot(display.configuration))
}

test.each([
  ['the pileup shown and no height', {}, 250],
  ['the pileup hidden and no height', { pileup: { show: false } }, 100],
  [
    'the pileup hidden and a height of 250',
    { pileup: { show: false }, height: 250 },
    250,
  ],
  [
    'the pileup shown and a height of 100',
    { pileup: { show: true }, height: 100 },
    100,
  ],
])('a track configured with %s opens at its height', (_, conf, height) => {
  expect(createDisplay(conf).height).toBe(height)
})

test.each([
  ['hiding the pileup', {}, false, 250],
  ['showing the pileup', { pileup: { show: false } }, true, 100],
])(
  '%s keeps the track height, and a reload keeps it too',
  (_, conf, show, height) => {
    const display = createDisplay(conf)
    display.setShowPileup(show)
    expect(display.showPileup).toBe(show)
    expect(display.height).toBe(height)

    const restored = reloaded(display)
    expect(restored.showPileup).toBe(show)
    expect(restored.height).toBe(height)
  },
)

test('a drag with the pileup hidden survives a reload', () => {
  const display = createDisplay({ pileup: { show: false } })
  display.resizeHeight(40)
  expect(display.height).toBe(140)
  expect(reloaded(display).height).toBe(140)
})
