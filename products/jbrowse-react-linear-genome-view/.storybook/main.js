module.exports = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-essentials'],
  framework: 'storybook-react-rsbuild',
  typescript: {
    reactDocgen: false,
  },
  rsbuildFinal: config => {
    config.output ||= {}
    config.output.assetPrefix = './'
    return config
  },
}
