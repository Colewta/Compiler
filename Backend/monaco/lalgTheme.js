export function defineLalgTheme(monaco) {
  monaco.editor.defineTheme('lalgTheme', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '2457D6', fontStyle: 'bold' },
      { token: 'type', foreground: '7A3FC1', fontStyle: 'bold' },
      { token: 'identifier', foreground: '26334D' },
      { token: 'number', foreground: 'C05A28' },
      { token: 'number.float', foreground: 'C05A28' },
      { token: 'string', foreground: '15805D' },
      { token: 'operator', foreground: '9B4B19' },
      { token: 'comment', foreground: '8B94A6', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.lineHighlightBackground': '#F5F8FF',
      'editorLineNumber.foreground': '#A1A9B8',
      'editorLineNumber.activeForeground': '#2457D6',
      'editor.selectionBackground': '#DDE7FF',
      'editorCursor.foreground': '#2457D6'
    }
  });
}
