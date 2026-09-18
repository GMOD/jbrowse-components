import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { CHANNEL_MENU_DISPLAYS } from './fields.ts'

// A display carrying both channel objects is one composing the canvas base
// display: `color` alone is also the wiggle displays' and `facet` alone the
// mark and multi-sample variant displays', and none of those has the Color
// by... and Group by... dialogs the recipe steps name. Read here rather than in
// `fields.ts` because the manifest is 190 kB the site would then build with.
test('the channel-menu displays are the ones carrying both channel objects', () => {
  const { displays } = configManifest
  const declares = (name: string, slot: string) =>
    (displays[name]?.slots ?? []).some(s => s.name === slot)
  expect(
    Object.keys(displays).filter(
      name => declares(name, 'color') && declares(name, 'facet'),
    ),
  ).toEqual([...CHANNEL_MENU_DISPLAYS])
})
