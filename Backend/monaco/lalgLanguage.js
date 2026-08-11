export function registerLalgLanguage(monaco) {
  const jaRegistrada = monaco.languages
    .getLanguages()
    .some((linguagem) => linguagem.id === 'lalg');

  if (!jaRegistrada) monaco.languages.register({ id: 'lalg' });

  monaco.languages.setMonarchTokensProvider('lalg', {
    defaultToken: '',
    tokenPostfix: '.lalg',

    keywords: [
      'program', 'procedure', 'begin', 'end', 'write', 'writeln', 'read', 'readln', 'var',
      'return', 'do', 'while', 'if', 'then', 'else', 'true', 'false',
    ],

    typeKeywords: [
      'int', 'integer', 'float', 'real', 'str', 'string', 'boolean',
    ],

    operators: [
      ':=', '==', '>=', '<=', '<>', '!=', '++', '--', '||', '&&',
      '+', '-', '/', '=', '<', '>', '*', '!', 'and', 'or', 'not', 'div',
    ],

    tokenizer: {
      root: [
        [/\{/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@stringDouble'],
        [/'/, 'string', '@stringSingle'],
        [/\d+\.\d+/, 'number.float'],
        [/\d+/, 'number'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, {
          cases: {
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@operators': 'operator',
            '@default': 'identifier',
          },
        }],
        [/:=|==|>=|<=|<>|!=|\+\+|--|\|\||&&/, 'operator'],
        [/[+\-/*=<>!]/, 'operator'],
        [/[()[\];,.]/, 'delimiter'],
        [/:/, 'delimiter'],
        [/\s+/, 'white'],
      ],

      comment: [
        [/[^}]+/, 'comment'],
        [/\}/, 'comment', '@pop'],
      ],

      stringDouble: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],

      stringSingle: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration('lalg', {
    comments: {
      lineComment: '//',
      blockComment: ['{', '}'],
    },
    brackets: [
      ['{', '}'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}
