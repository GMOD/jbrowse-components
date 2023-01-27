export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  options: {
    storySort: {
      order: [
        'Getting Started',
        'Default Sessions',
        'Linear View',
        'Nextstrain View',
        'Next.js Usage',
      ],
      locales: '',
    },
  },
}
