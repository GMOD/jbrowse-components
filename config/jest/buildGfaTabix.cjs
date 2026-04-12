const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = async () => {
  const binary = path.resolve('tools/gfa-to-tabix/target/release/gfa-to-tabix')
  if (!fs.existsSync(binary)) {
    try {
      execSync('cargo build --release', {
        cwd: path.resolve('tools/gfa-to-tabix'),
        stdio: 'inherit',
      })
    } catch {
      // cargo not available - gfa-to-tabix tests will be skipped
    }
  }
}
