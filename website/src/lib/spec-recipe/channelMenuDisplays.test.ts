import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { CHANNEL_MENU_DISPLAYS } from './fields.ts'

// A display carrying both flat channel slots is one composing the canvas base
// display: `colorField` alone is also Manhattan's and `facetField` alone the
// multi-sample variant displays', and neither of those has the Color by... and
// Group by... dialogs the recipe steps name. Read here rather than in
// `fields.ts` because the manifest is 190 kB the site would then build with.
test('the channel-menu displays are the ones carrying both flat channel slots', () => {
  const { displays } = configManifest
  const declares = (name: string, slot: string) =>
    (displays[name]?.slots ?? []).some(s => s.name === slot)
  expect(
    Object.keys(displays).filter(
      name => declares(name, 'colorField') && declares(name, 'facetField'),
    ),
  ).toEqual([...CHANNEL_MENU_DISPLAYS])
})
