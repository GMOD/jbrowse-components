const fs = require('fs')

fs.writeFileSync(
  'build/version.txt',
  JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
)
