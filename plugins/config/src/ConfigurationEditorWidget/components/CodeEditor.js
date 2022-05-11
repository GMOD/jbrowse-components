import React, { useEffect } from 'react'
import Editor from 'react-simple-code-editor'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/cjs/languages/hljs/json'
import a11yDark from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-dark'
import a11yLight from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-light'
import { useTheme } from '@mui/material'
import { makeStyles } from '@mui/styles'

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'
// Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles({
  callbackEditor: {
    fontFamily,
    fontSize,
    overflowX: 'auto',
    marginTop: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.42)',
  },
  syntaxHighlighter: {
    margin: 0,
    fontFamily,
    fontSize,
  },
})

 
export default function CodeEditor({ contents, setContents }) {
  const classes = useStyles()
  const theme = useTheme()
  useEffect(() => {
    SyntaxHighlighter.registerLanguage('json', json)
  }, [])

  return (
    <Editor
      className={classes.callbackEditor}
      value={contents}
      onValueChange={setContents}
      highlight={newCode => (
        <SyntaxHighlighter
          language="json"
          style={theme.palette.type === 'dark' ? a11yDark : a11yLight}
          className={classes.syntaxHighlighter}
          // override some inline style stuff that's higher specificity
          // than className
          customStyle={{ background: 'none', padding: 0 }}
        >
          {newCode}
        </SyntaxHighlighter>
      )}
      padding={10}
      style={{}}
    />
  )
}
