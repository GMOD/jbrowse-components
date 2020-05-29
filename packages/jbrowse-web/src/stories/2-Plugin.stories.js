import React from 'react'
import { action } from '@storybook/addon-actions'
import { Button } from '@storybook/react/demo'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default {
  title: 'PluginManager',
  component: Button,
}

export const Text = () => {
  return <Button onClick={action('clicked')}>Hello Button</Button>
}
