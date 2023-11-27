const fs = require('fs')

const data = JSON.parse(fs.readFileSync('./docusaurus.config.json'))

module.exports = {
  ...data,
  plugins: [
    [
      require.resolve('@cmfcmf/docusaurus-search-local'),
      {
        maxSearchResults: 20,
      },
    ],
  ],
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.json'),
          editUrl: ({ docPath }) => {
            return `https://holocron.so/github/pr/GMOD/jbrowse-components/main/editor/website/docs/${docPath}`
          },
        },
        blog: {
          blogSidebarCount: 'ALL',
          editUrl: ({ docPath }) => {
            return `https://holocron.so/github/pr/GMOD/jbrowse-components/main/editor/website/blog/${docPath}`
          },
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
}
