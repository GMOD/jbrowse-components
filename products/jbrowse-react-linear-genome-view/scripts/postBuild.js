/* 
This script reverts the changes made by preBuild
after storybook has been built by removing the
local files and re-creating a symlink to test_data
*/

const fs = require('fs')
const process = require('process')

function main() {
  // get rid of any existing test_data folder
  // fs.rmdirSync('public/test_data', { recursive: true })
  // re-create the symlink
  process.chdir('./public')
  fs.symlinkSync('../../../test_data/', './test_data')
}

main()
