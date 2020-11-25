/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
const spawn = require('cross-spawn')

function main(version, changed) {
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

const version = process.argv[2]
if (!version) {
  throw new Error('No version provided')
}
const changed = process.argv[3]
if (!changed) {
  throw new Error('No list of changed packages provided')
}
main(version, changed)
