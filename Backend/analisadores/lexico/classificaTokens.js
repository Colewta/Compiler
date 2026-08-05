const mapaDeTokens = {
    // Palavras Reservadas
    'program': 'PALAVRA_RESERVADA',
    'procedure': 'PALAVRA_RESERVADA',
    'begin': 'PALAVRA_RESERVADA',
    'end': 'PALAVRA_RESERVADA',
    'write': 'PALAVRA_RESERVADA',
    'read': 'PALAVRA_RESERVADA',
    'var': 'PALAVRA_RESERVADA',
    'true': 'PALAVRA_RESERVADA',
    'false': 'PALAVRA_RESERVADA',
    'return': 'PALAVRA_RESERVADA',

    // Controle de Fluxo
    'do': 'CONTROLE_FLUXO',
    'while': 'CONTROLE_FLUXO',
    'if': 'CONTROLE_FLUXO',
    'then': 'CONTROLE_FLUXO',
    'else': 'CONTROLE_FLUXO',

    // Tipos de Dados
    'int': 'TIPO_DADO',
    'integer': 'TIPO_DADO',
    'float': 'TIPO_DADO',
    'real': 'TIPO_DADO',
    'str': 'TIPO_DADO',
    'string': 'TIPO_DADO',
    'boolean': 'TIPO_DADO',

    // Operadores MatemÃ¡ticos
    '+': 'OPERADOR_MATEMATICO',
    '-': 'OPERADOR_MATEMATICO',
    '/': 'OPERADOR_MATEMATICO',
    '*': 'OPERADOR_MATEMATICO',
    '++': 'OPERADOR_MATEMATICO',
    '--': 'OPERADOR_MATEMATICO',

    // Operadores Relacionais
    '>': 'OPERADOR_RELACIONAL',
    '<': 'OPERADOR_RELACIONAL',
    '>=': 'OPERADOR_RELACIONAL',
    '<=': 'OPERADOR_RELACIONAL',
    '=': 'OPERADOR_RELACIONAL',
    '==': 'OPERADOR_RELACIONAL',
    '<>': 'OPERADOR_RELACIONAL',
    '!=': 'OPERADOR_RELACIONAL',

    // Operadores LÃ³gicos
    'and': 'OPERADOR_LOGICO',
    'or': 'OPERADOR_LOGICO',
    'not': 'OPERADOR_LOGICO',
    '||': 'OPERADOR_LOGICO',
    '&&': 'OPERADOR_LOGICO',
    '!': 'OPERADOR_LOGICO',

    // Operadores de AtribuiÃ§Ã£o
    ':=': 'OPERADOR_ATRIBUICAO',

    // Delimitadores / PontuaÃ§Ã£o
    '(': 'ABRE_PARENTESIS',
    ')': 'FECHA_PARENTESIS',
    ';': 'PONTO_E_VIRGULA',
    ',': 'VIRGULA',
    ':': 'DOIS_PONTOS',
    '.': 'PONTO_FINAL'
};

//FUNÃ‡ÃƒO AUXILIAR
function criaObjeto(tipo, valor, linha) {
    return {
        tipo: tipo,
        valor: valor,
        linha: linha
    };
}

//FUNÃ‡ÃƒO DE CLASSIFICAÃ‡ÃƒO
export function classificaTokens(token, linha) {
    // 1. Busca direta no dicionÃ¡rio (Busca O(1) - InstantÃ¢nea)
    const tipoEncontrado = mapaDeTokens[token];

    if (tipoEncontrado) {
        return criaObjeto(tipoEncontrado, token, linha);
    }

    // 2. Se nÃ£o estÃ¡ no dicionÃ¡rio, verifica se Ã© Identificador
    // Regra: ComeÃ§a com letra, seguido de letras ou nÃºmeros
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
        return criaObjeto('IDENTIFICADOR', token, linha);
    }

    // 3. Verifica se Ã© um NÃºmero
    // Regra: Um ou mais dÃ­gitos, opcionalmente seguidos de ponto e mais dÃ­gitos
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
        return criaObjeto('NUMERO', token, linha);
    }

    // 4. Verifica se Ã© uma String
    // Regra: ComeÃ§a e termina com aspas simples ou duplas
    if (/^["'].*["']$/.test(token)) {
        return criaObjeto('STRING', token, linha);
    }

    // 5. Se o token nÃ£o bateu com ABSOLUTAMENTE NADA, Ã© um caractere proibido!
    return criaObjeto('ERRO_LEXICO', token, linha);
}
