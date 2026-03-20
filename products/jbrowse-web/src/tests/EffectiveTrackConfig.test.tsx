import { getPluginManager } from './util.tsx'

function getTrackAndDisplay(trackId: string) {
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.views[0] as {
    showTrack: (id: string) => void
    tracks: {
      trackId: string
      activeDisplay: { type: string; effectiveTrackConfig: Record<string, unknown>; [key: string]: unknown }
      displays: { type: string; effectiveTrackConfig: Record<string, unknown>; [key: string]: unknown }[]
    }[]
  }
  view.showTrack(trackId)
  const track = view.tracks.find(t => t.trackId === trackId)!
  return { track, display: track.displays[0]!, rootModel, session, view }
}

test('activeDisplay returns displays[0]', () => {
  const { track } = getTrackAndDisplay('volvox_gc')
  expect(track.activeDisplay).toBe(track.displays[0])
})

test('effectiveTrackConfig is defined on all displays', () => {
  const { display } = getTrackAndDisplay('volvox_gc')
  expect(display.effectiveTrackConfig).toBeDefined()
})

test('effective config preserves track-level properties', () => {
  const { display } = getTrackAndDisplay('volvox_gc')
  expect(display.effectiveTrackConfig.trackId).toBe('volvox_gc')
  expect(Array.isArray(display.effectiveTrackConfig.displays)).toBe(true)
})

test('effective config includes display overrides for wiggle', () => {
  const { display } = getTrackAndDisplay('volvox_gc')

  if ('setScaleType' in display) {
    ;(display as unknown as { setScaleType: (s: string) => void }).setScaleType('log')
    const displays = display.effectiveTrackConfig.displays as Record<string, unknown>[]
    const hasLogScale = displays.some(d => d.scaleType === 'log')
    expect(hasLogScale).toBe(true)
  }
})

test('effective config does not modify unchanged slots', () => {
  const { display } = getTrackAndDisplay('volvox_gc')
  const displays = display.effectiveTrackConfig.displays as Record<string, unknown>[]
  const displayEntry = displays[0]!
  expect(displayEntry.scaleType).toBeUndefined()
})

test('effective config for non-wiggle track still works', () => {
  const { display } = getTrackAndDisplay('volvox_filtered_vcf')
  expect(display.effectiveTrackConfig.trackId).toBe('volvox_filtered_vcf')
  expect(Array.isArray(display.effectiveTrackConfig.displays)).toBe(true)
})
