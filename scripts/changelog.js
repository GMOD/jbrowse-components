/* eslint-disable no-console */
const spawn = require('cross-spawn')

function main(changed, version) {
  const lernaChangelog = spawn.sync(
    'yarn',
    ['--silent', 'lerna-changelog', '--next-version', version],
    { encoding: 'utf8' },
  ).stdout
  const changelogLines = lernaChangelog.split('\n')
  const changedPackages = JSON.parse(changed)
  const updatesTable = ['| Package | Download |', '| --- | --- |']
  changedPackages.forEach(changedPackage => {
    const { name } = changedPackage
    const link = changedPackage.private
      ? ''
      : `https://www.npmjs.com/package/${name}`
    updatesTable.push(`| ${name} | ${link} |`)
  })
  const updatesDetails = [
    '<details><summary>Packages in this release</summary>',
    '<p>',
    '',
    ...updatesTable,
    '',
    '</p>',
    '</details>',
    '',
  ]
  changelogLines.splice(3, 0, ...updatesDetails)
  console.log(`${changelogLines.join('\n')}\n`)
}

const changed = process.argv[2]
if (!changed) {
  throw new Error('No list of changed packages provided')
}
const version = process.argv[3]
if (!version) {
  throw new Error('No new version provided')
}
main(changed, version)
