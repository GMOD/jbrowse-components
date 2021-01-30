import jexl from 'jexl'
import { Feature } from './simpleFeature'

// main notes will go here for jexl

// this will contain the default jexl from https://github.com/TomFrost/Jexl
// here, we will add any helper functions that jexl will need with jexl.addFunction
// then in other files, they can import this custom jexl with added helper functions

// other files that will need to be used: functionStrings.ts, configurationSlot.ts, core/util.ts, maybe CallbackEditor.js
// and any files that have function strings in their default config scheme

// how the flow of data works:
// 1. user edits the default 'jexl string' using the config slot callback editor
// 2. default will look like 'jexl: getFeatureData()', edit will be like 'jexl: getFeatureData(feature, 'strand') == "+" ? 'blue' : 'red'. jexl: part will not be edited
// 3. the string will be passed to function strings. on line ~53 instead of new function it will be like jexl.createExpression(('textFromEditor || default').remove('jexl:'))
// 4. the return of this will be used in configurationSlot where stringToFunction is called. There will be an edited isCallback() function that checks for the jexl: string to
//    make sure that the string is supposed to be a jexl function
// 5. in utils.js is where readConfig is called. When the function is passed there, jexl.eval(args) will be called, where args is the created jexl expression from above

// helper functions
jexl.addFunction('getFeatureData', (feature: Feature, data: string) => {
  return feature.get(data)
})
jexl.addFunction('getColor', (feature: Feature, color: string) => {
  return color || '#c8c8c8'
})
export default jexl
