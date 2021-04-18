// import { promises as fsPromises } from 'fs'
// import path from 'path'
// import { URL } from 'url'
// import { toArray } from 'rxjs/operators'
import Adapter from './JBrowse1TextSearchAdater'
import configSchema from './configSchema'

test('adapter can fetch files from names index', async () => {
//   const rootTemplate = path
//     .join(__dirname, '..', '..','..', '..','test_data', 'volvox', 'names')
//     .replace(/\\/g, '\\\\')
  const args = {
    namesIndexDirPath: '/test_data/volvox/names/',
  }
  const adapter = new Adapter(configSchema.create(args))
  console.log(args)

})
