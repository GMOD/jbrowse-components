module.exports = {
  title: 'JBrowse 2',
  url: 'https://jbrowse.org',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'GMOD', // Usually your GitHub org/user name.
  projectName: 'jbrowse-components', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'JBrowse',
      logo: {
        alt: 'JBrowse Logo',
        src: 'img/logo.svg',
      },
      links: [
        {
          to: 'docs/intro',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {to: 'blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/GMOD/jbrowse-components',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Intro',
              to: 'docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/GMOD/jbrowse-components',
            },
            {
              label: 'Gitter',
              href: 'https://gitter.im/GMOD/jbrowse2',
            }
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: 'blog',
            }
          ],
        },
      ]
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/GMOD/jbrowse-components/edit/master/website/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/GMOD/jbrowse-components/edit/master/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
