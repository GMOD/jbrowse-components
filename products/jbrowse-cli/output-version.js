// used to output a version.js file to the src folder
// this avoids bundlers having to know how to import ../../package.json or similar for downstream consumers
const fs = require('fs')

console.log(
  `export const version = '${
    JSON.parse(fs.readFileSync('package.json')).version
  }'`,
)
