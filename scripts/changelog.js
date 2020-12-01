/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
const spawn = require('cross-spawn')

function main(changed) {
  const lernaChangelog = spawn.sync('yarn', ['--silent', 'lerna-changelog'], {
    encoding: 'utf8',
  }).stdout
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
main(changed)
