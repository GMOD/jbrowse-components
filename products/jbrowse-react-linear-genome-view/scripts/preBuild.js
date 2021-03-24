/* 
This script replaces symlinked volvox data used
in the stories with local files before building
the static storybook site. the postBuild script
reverts these changes after build.
*/

const fs = require('fs')
const path = require('path')

function main() {
  // get rid of any existing test_data symlink
  fs.unlinkSync('public/test_data')
  // create the volvox directory to put files in
  fs.mkdirSync('public/test_data/', { recursive: true })
  // copy volvox into new directory
  copyFolderRecursiveSync('../../test_data/volvox', 'public/test_data/')
}

function copyFileSync(source, target) {
  let targetFile = target

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source))
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source))
}

function copyFolderRecursiveSync(source, target) {
  let files = []

  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder)
  }

  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source)
    files.forEach(file => {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder)
      } else if (file !== '.DS_Store') {
        copyFileSync(curSource, targetFolder)
      }
    })
  }
}

main()
