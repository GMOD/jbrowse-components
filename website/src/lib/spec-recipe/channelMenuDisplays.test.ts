import { configManifest } from '../../../../products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'
import { CHANNEL_MENU_DISPLAYS } from './fields.ts'

// The canvas feature displays are the ones with the Color by... and Group
// by... dialogs the recipe steps name: both channel objects beside a
// `displayMode`. The three quantitative displays carry `color` and `facet`
// too, with one Edit color... box and a checkbox. Read here rather than in
// `fields.ts` because the
// manifest is 190 kB the site would then build with.
test('the channel-menu displays are the canvas feature displays', () => {
  const { displays } = configManifest
  const declares = (name: string, slot: string) =>
    (displays[name]?.slots ?? []).some(s => s.name === slot)
  expect(
    Object.keys(displays).filter(
      name =>
        declares(name, 'color') &&
        declares(name, 'facet') &&
        declares(name, 'displayMode'),
    ),
  ).toEqual([...CHANNEL_MENU_DISPLAYS])
})
