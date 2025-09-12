const fs = require('fs')

const data = JSON.parse(fs.readFileSync('./docusaurus.config.json'))

module.exports = {
  ...data,

  future: {
    experimental_faster: true,
    v4: true,
  },
  themeConfig: {
    colorMode: {
      disableSwitch: true,
    },
    navbar: {
      title: 'JBrowse',
      logo: {
        alt: 'JBrowse',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: 'http://genomes.jbrowse.org/',
          label: 'Genomes',
          className: 'new_feature',
          position: 'left',
        },
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {
          to: 'blog',
          label: 'Blog',
          position: 'left',
        },
        {
          to: 'download',
          label: 'Download',
          position: 'left',
        },
        {
          to: 'plugin_store',
          label: 'Plugins',
          position: 'left',
        },
        {
          to: 'features',
          label: 'Features',
          position: 'left',
        },
        {
          to: 'gallery',
          label: 'Gallery',
          position: 'left',
        },
        {
          to: 'demos',
          label: 'Demos',
          position: 'left',
        },
        {
          to: 'contact/',
          label: 'Contact',
          position: 'left',
        },
        {
          href: 'https://jbrowse.org/jbrowse1.html',
          label: 'Looking for JBrowse 1?',
          position: 'right',
        },
        {
          className: 'navbar-social-github',
          position: 'right',
          alt: 'Github',
          href: 'https://github.com/GMOD/jbrowse-components',
        },
        {
          className: 'navbar-social-mastodon',
          alt: 'Mastodon',
          position: 'right',
          href: 'https://genomic.social/@usejbrowse',
        },
        {
          className: 'navbar-social-bluesky',
          alt: 'Bluesky',
          position: 'right',
          href: 'https://bsky.app/profile/jbrowse.org',
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
              label: 'Documentation',
              to: 'docs/',
            },
            {
              label: 'Cancer resources',
              to: 'cancer/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Gitter chat',
              href: 'https://app.gitter.im/#/room/#GMOD_jbrowse2:gitter.im',
            },
            {
              label: 'Bluesky',
              href: 'https://bsky.app/profile/jbrowse.org',
            },
            {
              label: 'Mastodon',
              href: 'https://genomic.social/@usejbrowse',
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
              label: 'Contact',
              to: 'contact',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/GMOD/jbrowse-components',
            },
            {
              label: 'Looking for JBrowse 1?',
              href: 'https://jbrowse.org/jbrowse1.html',
            },
          ],
        },
      ],
      copyright: 'Copyright © 2020 Evolutionary Software Foundation, Inc.',
    },
  },
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
        gtag: {
          trackingID: 'G-TRMBQZRJW7',
          anonymizeIP: true,
        },
        docs: {
          sidebarPath: require.resolve('./sidebars.json'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/GMOD/jbrowse-components/edit/main/website/',
        },
        blog: {
          onUntruncatedBlogPosts: 'ignore',
          onInlineAuthors: 'ignore',
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
