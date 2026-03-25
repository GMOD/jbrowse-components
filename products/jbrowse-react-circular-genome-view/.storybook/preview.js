const GITHUB_BASE =
  'https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/stories/examples/'

export const decorators = [
  (Story, { parameters, viewMode }) => {
    const sourceCode = parameters.docs?.source?.code
    const storyFile = parameters.storyFile
    return (
      <div>
        <Story />
        {sourceCode && viewMode === 'story' && (
          <>
            {storyFile && (
              <a
                href={`${GITHUB_BASE}${storyFile}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', margin: '1em 0 0' }}
              >
                Source code on GitHub
              </a>
            )}
            <pre
              style={{
                overflow: 'auto',
                background: '#f6f8fa',
                border: '1px solid #d0d7de',
                borderRadius: 6,
                padding: '1em',
                margin: '0.5em 0 0',
                fontSize: '0.85em',
                lineHeight: 1.5,
              }}
            >
              <code>{sourceCode}</code>
            </pre>
          </>
        )}
      </div>
    )
  },
]

export const parameters = {
  options: {
    storySort: {
      order: ['Getting Started'],
      locales: '',
    },
  },
}
