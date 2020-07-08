module.exports = {
  title: 'JBrowse',
  tagline: 'Next generation genome browser',
  url: 'https://jbrowse.com',
  baseUrl: '/jb2/',
  favicon: 'img/favicon.ico',
  organizationName: 'GMOD', // Usually your GitHub org/user name.
  projectName: 'jbrowse-components', // Usually your repo name.
  themeConfig: {
    disableDarkMode: true,
    navbar: {
      title: 'JBrowse',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.svg',
      },
      links: [
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        { to: 'blog', label: 'Blog', position: 'left' },
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
              label: 'Style Guide',
              to: 'docs/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Gitter',
              href: 'https://gitter.im/GMOD/jbrowse',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/usejbrowse',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: 'blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/GMOD/jbrowse-components',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Evolutionary Software Foundation, Inc.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          homePageId: 'introduction',
          sidebarPath: require.resolve('./sidebars.json'),
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
}
