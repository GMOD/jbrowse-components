const fs = require('fs')

const data = JSON.parse(fs.readFileSync('./docusaurus.config.json'))

module.exports = {
  ...data,

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.json'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/GMOD/jbrowse-components/edit/main/website/',
        },
        blog: {
          blogSidebarCount: 'ALL',
          // Please change this to your repo.
          editUrl:
            'https://github.com/GMOD/jbrowse-components/edit/main/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
}
