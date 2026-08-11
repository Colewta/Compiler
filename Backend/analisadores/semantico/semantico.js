const TIPOS = Object.freeze({
    INTEIRO: 'integer',
    REAL: 'real',
    STRING: 'string',
    BOOLEANO: 'boolean',
    PROGRAMA: 'program',
    PROCEDIMENTO: 'procedure',
    ERRO: '<erro>',
    DESCONHECIDO: '<desconhecido>'
});

const TIPOS_NORMALIZADOS = Object.freeze({
    int: TIPOS.INTEIRO,
    integer: TIPOS.INTEIRO,
    float: TIPOS.REAL,
    real: TIPOS.REAL,
    str: TIPOS.STRING,
    string: TIPOS.STRING,
    boolean: TIPOS.BOOLEANO,
    program: TIPOS.PROGRAMA,
    procedure: TIPOS.PROCEDIMENTO
});

function normalizarTipo(tipo) {
    if (!tipo) return TIPOS.DESCONHECIDO;
    return TIPOS_NORMALIZADOS[String(tipo).toLowerCase()] ?? String(tipo).toLowerCase();
}

function ehNumerico(tipo) {
    return tipo === TIPOS.INTEIRO || tipo === TIPOS.REAL;
}

function tipoLegivel(tipo) {
    const nomes = {
        [TIPOS.INTEIRO]: 'integer',
        [TIPOS.REAL]: 'real',
        [TIPOS.STRING]: 'string',
        [TIPOS.BOOLEANO]: 'boolean',
        [TIPOS.PROGRAMA]: 'program',
        [TIPOS.PROCEDIMENTO]: 'procedure',
        [TIPOS.ERRO]: 'inválido',
        [TIPOS.DESCONHECIDO]: 'desconhecido'
    };

    return nomes[tipo] ?? tipo;
}

function chaveDoSimbolo(nome, escopo = 'global') {
    return escopo === 'global' ? nome : `${escopo}.${nome}`;
}

function extrairTabela(entrada) {
    if (!entrada || typeof entrada !== 'object') return null;
    return entrada.tabelaSintatica ?? entrada;
}

function extrairErrosSintaticos(entrada, tabela) {
    const candidatos = [
        entrada?.errosSintaticos,
        tabela?.erros,
        entrada?.arvoreSintatica?.erros
    ];

    for (const erros of candidatos) {
        if (Array.isArray(erros) && erros.length > 0) return erros;
    }

    return [];
}

class AvaliadorExpressao {
    constructor(analisador, expressao, escopo, contexto) {
        this.analisador = analisador;
        this.tokens = Array.isArray(expressao?.tokens) ? expressao.tokens : [];
        this.escopo = escopo;
        this.contexto = contexto;
        this.ptr = 0;
    }

    atual() {
        return this.tokens[this.ptr] ?? null;
    }

    anterior() {
        return this.tokens[this.ptr - 1] ?? null;
    }

    fim() {
        return this.ptr >= this.tokens.length;
    }

    verificarTipo(tipo) {
        return this.atual()?.tipo === tipo;
    }

    verificarValor(...valores) {
        return valores.includes(this.atual()?.valor);
    }

    avancar() {
        const token = this.atual();
        if (!this.fim()) this.ptr++;
        return token;
    }

    combinarValor(...valores) {
        if (!this.verificarValor(...valores)) return false;
        this.avancar();
        return true;
    }

    avaliar() {
        if (this.tokens.length === 0) {
            this.analisador.adicionarErro(
                'EXPRESSAO_VAZIA',
                null,
                'Expressão vazia.'
            );
            return TIPOS.ERRO;
        }

        const tipo = this.expressaoOu();

        if (!this.fim()) {
            const token = this.atual();
            this.analisador.adicionarErro(
                'EXPRESSAO_INVALIDA',
                token?.linha,
                `Token inesperado "${token?.valor}" na expressão.`
            );
            return TIPOS.ERRO;
        }

        return tipo;
    }

    expressaoOu() {
        let tipo = this.expressaoE();

        while (this.combinarValor('or', '||')) {
            const operador = this.anterior();
            const direito = this.expressaoE();
            tipo = this.operacaoLogica(tipo, direito, operador);
        }

        return tipo;
    }

    expressaoE() {
        let tipo = this.expressaoRelacional();

        while (this.combinarValor('and', '&&')) {
            const operador = this.anterior();
            const direito = this.expressaoRelacional();
            tipo = this.operacaoLogica(tipo, direito, operador);
        }

        return tipo;
    }

    expressaoRelacional() {
        let tipo = this.expressaoAditiva();

        while (this.verificarTipo('OPERADOR_RELACIONAL')) {
            const operador = this.avancar();
            const direito = this.expressaoAditiva();
            tipo = this.operacaoRelacional(tipo, direito, operador);
        }

        return tipo;
    }

    expressaoAditiva() {
        let tipo = this.expressaoMultiplicativa();

        while (this.verificarValor('+', '-')) {
            const operador = this.avancar();
            const direito = this.expressaoMultiplicativa();
            tipo = this.operacaoAritmetica(tipo, direito, operador);
        }

        return tipo;
    }

    expressaoMultiplicativa() {
        let tipo = this.expressaoUnaria();

        while (this.verificarValor('*', '/', 'div')) {
            const operador = this.avancar();
            const direito = this.expressaoUnaria();
            tipo = this.operacaoAritmetica(tipo, direito, operador);
        }

        return tipo;
    }

    expressaoUnaria() {
        if (this.combinarValor('!', 'not')) {
            const operador = this.anterior();
            const tipo = this.expressaoUnaria();

            if (tipo !== TIPOS.ERRO && tipo !== TIPOS.BOOLEANO) {
                this.analisador.adicionarErro(
                    'OPERADOR_LOGICO_TIPO_INVALIDO',
                    operador?.linha,
                    `O operador "${operador?.valor}" exige um operando boolean, mas recebeu ${tipoLegivel(tipo)}.`
                );
                return TIPOS.ERRO;
            }

            return tipo === TIPOS.ERRO ? TIPOS.ERRO : TIPOS.BOOLEANO;
        }

        if (this.combinarValor('+', '-')) {
            const operador = this.anterior();
            const tipo = this.expressaoUnaria();

            if (tipo !== TIPOS.ERRO && !ehNumerico(tipo)) {
                this.analisador.adicionarErro(
                    'OPERADOR_ARITMETICO_TIPO_INVALIDO',
                    operador?.linha,
                    `O operador unário "${operador?.valor}" exige um número, mas recebeu ${tipoLegivel(tipo)}.`
                );
                return TIPOS.ERRO;
            }

            return tipo;
        }

        return this.expressaoPrimaria();
    }

    expressaoPrimaria() {
        const token = this.atual();

        if (!token) {
            this.analisador.adicionarErro(
                'OPERANDO_AUSENTE',
                this.anterior()?.linha,
                'Operando ausente na expressão.'
            );
            return TIPOS.ERRO;
        }

        if (token.tipo === 'NUMERO') {
            this.avancar();
            return String(token.valor).includes('.') ? TIPOS.REAL : TIPOS.INTEIRO;
        }

        if (token.tipo === 'STRING') {
            this.avancar();
            return TIPOS.STRING;
        }

        if (token.valor === 'true' || token.valor === 'false') {
            this.avancar();
            return TIPOS.BOOLEANO;
        }

        if (token.tipo === 'IDENTIFICADOR') {
            this.avancar();

            if (this.combinarValor('(')) {
                const argumentos = this.argumentos();
                if (!this.combinarValor(')')) {
                    this.analisador.adicionarErro(
                        'PARENTESE_NAO_FECHADO',
                        token.linha,
                        `A chamada de "${token.valor}" não possui ")" de fechamento.`
                    );
                }

                this.analisador.verificarChamada(
                    token.valor,
                    argumentos,
                    this.escopo,
                    token.linha,
                    true
                );
                return TIPOS.ERRO;
            }

            return this.analisador.tipoDoIdentificador(
                token.valor,
                this.escopo,
                token.linha,
                this.contexto
            );
        }

        if (this.combinarValor('(')) {
            const tipo = this.expressaoOu();
            if (!this.combinarValor(')')) {
                this.analisador.adicionarErro(
                    'PARENTESE_NAO_FECHADO',
                    token.linha,
                    'Parêntese não fechado na expressão.'
                );
                return TIPOS.ERRO;
            }
            return tipo;
        }

        this.avancar();
        this.analisador.adicionarErro(
            'OPERANDO_INVALIDO',
            token.linha,
            `"${token.valor}" não é um operando válido.`
        );
        return TIPOS.ERRO;
    }

    argumentos() {
        const argumentos = [];

        if (this.verificarValor(')')) return argumentos;

        while (!this.fim()) {
            argumentos.push({
                tipo: this.expressaoOu(),
                linha: this.atual()?.linha ?? this.anterior()?.linha
            });

            if (!this.combinarValor(',')) break;
        }

        return argumentos;
    }

    operacaoLogica(esquerdo, direito, operador) {
        if (esquerdo === TIPOS.ERRO || direito === TIPOS.ERRO) return TIPOS.ERRO;

        if (esquerdo !== TIPOS.BOOLEANO || direito !== TIPOS.BOOLEANO) {
            this.analisador.adicionarErro(
                'OPERADOR_LOGICO_TIPOS_INVALIDOS',
                operador?.linha,
                `O operador "${operador?.valor}" exige operandos boolean, mas recebeu ${tipoLegivel(esquerdo)} e ${tipoLegivel(direito)}.`
            );
            return TIPOS.ERRO;
        }

        return TIPOS.BOOLEANO;
    }

    operacaoAritmetica(esquerdo, direito, operador) {
        if (esquerdo === TIPOS.ERRO || direito === TIPOS.ERRO) return TIPOS.ERRO;

        if (
            operador?.valor === '+' &&
            esquerdo === TIPOS.STRING &&
            direito === TIPOS.STRING
        ) {
            return TIPOS.STRING;
        }

        if (!ehNumerico(esquerdo) || !ehNumerico(direito)) {
            this.analisador.adicionarErro(
                'OPERADOR_ARITMETICO_TIPOS_INVALIDOS',
                operador?.linha,
                `O operador "${operador?.valor}" exige operandos numéricos, mas recebeu ${tipoLegivel(esquerdo)} e ${tipoLegivel(direito)}.`
            );
            return TIPOS.ERRO;
        }

        if (operador?.valor === '/' || operador?.valor === 'div') {
            if (esquerdo !== TIPOS.INTEIRO || direito !== TIPOS.INTEIRO) {
                this.analisador.adicionarErro(
                    'DIVISAO_TIPOS_INVALIDOS',
                    operador?.linha,
                    `A divisão inteira "${operador?.valor}" exige dois operandos integer, mas recebeu ${tipoLegivel(esquerdo)} e ${tipoLegivel(direito)}.`
                );
                return TIPOS.ERRO;
            }
            return TIPOS.INTEIRO;
        }

        if (esquerdo === TIPOS.REAL || direito === TIPOS.REAL) return TIPOS.REAL;

        return TIPOS.INTEIRO;
    }

    operacaoRelacional(esquerdo, direito, operador) {
        if (esquerdo === TIPOS.ERRO || direito === TIPOS.ERRO) return TIPOS.ERRO;

        const igualdade = ['=', '==', '<>', '!='].includes(operador?.valor);
        const tiposCompativeis = esquerdo === direito ||
            (ehNumerico(esquerdo) && ehNumerico(direito));

        if (igualdade && tiposCompativeis && esquerdo !== TIPOS.PROCEDIMENTO) {
            return TIPOS.BOOLEANO;
        }

        if (!igualdade && ehNumerico(esquerdo) && ehNumerico(direito)) {
            return TIPOS.BOOLEANO;
        }

        this.analisador.adicionarErro(
            'COMPARACAO_TIPOS_INVALIDOS',
            operador?.linha,
            `Não é possível comparar ${tipoLegivel(esquerdo)} com ${tipoLegivel(direito)} usando "${operador?.valor}".`
        );
        return TIPOS.ERRO;
    }
}

export class AnalisadorSemantico {
    constructor(entrada, opcoes = {}) {
        this.entrada = entrada;
        this.tabela = extrairTabela(entrada);
        this.opcoes = {
            exigirInicializacao: false,
            analisarComErrosSintaticos: false,
            ...opcoes
        };
        this.erros = [];
        this.avisos = [];
        this.chavesErros = new Set();
        this.simbolos = new Map();
        this.inicializados = new Map();
        this.utilizados = new Set();
        this.errosSintaticos = extrairErrosSintaticos(entrada, this.tabela);
    }

    adicionarErro(codigo, linha, mensagem, dados = {}) {
        const chave = `${codigo}|${linha ?? ''}|${mensagem}`;
        if (this.chavesErros.has(chave)) return;
        this.chavesErros.add(chave);

        this.erros.push({
            codigo,
            linha: linha ?? null,
            mensagem: linha == null
                ? `Erro semântico: ${mensagem}`
                : `Erro semântico na linha ${linha}: ${mensagem}`,
            ...dados
        });
    }

    registrarSimbolo(entrada) {
        if (!entrada?.nome) return null;

        const escopo = entrada.escopo ?? 'global';
        const chave = entrada.chave ?? chaveDoSimbolo(entrada.nome, escopo);
        const existente = this.simbolos.get(chave);

        if (existente) {
            this.adicionarErro(
                'IDENTIFICADOR_JA_DECLARADO',
                entrada.linha,
                `O identificador "${entrada.nome}" já foi declarado no escopo "${escopo}"` +
                    (existente.linha != null ? ` na linha ${existente.linha}.` : '.'),
                { nome: entrada.nome, escopo }
            );
            return existente;
        }

        const categoria = entrada.categoria ??
            (normalizarTipo(entrada.tipo) === TIPOS.PROCEDIMENTO
                ? 'procedimento'
                : 'variavel');
        const simbolo = {
            nome: entrada.nome,
            tipo: normalizarTipo(entrada.tipo),
            tipoOriginal: entrada.tipo ?? null,
            categoria,
            escopo,
            chave,
            linha: entrada.linha ?? null,
            parametros: Array.isArray(entrada.parametros) ? entrada.parametros : [],
            inicializacao: entrada.inicializacao ?? null
        };

        this.simbolos.set(chave, simbolo);
        this.inicializados.set(
            chave,
            categoria === 'parametro' || Boolean(entrada.inicializado)
        );
        return simbolo;
    }

    montarTabelaSimbolos() {
        const declaracoes = Array.isArray(this.tabela?.declaracoes)
            ? this.tabela.declaracoes
            : [];
        const procedimentos = Array.isArray(this.tabela?.procedimentos)
            ? this.tabela.procedimentos
            : [];

        if (this.tabela?.programa?.nome) {
            this.registrarSimbolo({
                nome: this.tabela.programa.nome,
                tipo: TIPOS.PROGRAMA,
                categoria: 'programa',
                escopo: 'global',
                linha: this.tabela.programa.linha,
                inicializado: true
            });
        }

        for (const declaracao of declaracoes) {
            this.registrarSimbolo(declaracao);
        }

        for (const procedimento of procedimentos) {
            this.registrarSimbolo({
                ...procedimento,
                tipo: TIPOS.PROCEDIMENTO,
                categoria: 'procedimento'
            });
        }

        const simbolosDoParser = this.tabela?.simbolos;
        if (simbolosDoParser && typeof simbolosDoParser === 'object') {
            for (const simbolo of Object.values(simbolosDoParser)) {
                const chave = simbolo?.chave ??
                    chaveDoSimbolo(simbolo?.nome, simbolo?.escopo);
                if (simbolo?.nome && !this.simbolos.has(chave)) {
                    this.registrarSimbolo(simbolo);
                }
            }
        }
    }

    resolverSimbolo(nome, escopo = 'global') {
        const partes = String(escopo || 'global').split('.');

        while (partes.length > 0) {
            const escopoCandidato = partes.join('.');
            const chave = chaveDoSimbolo(nome, escopoCandidato);
            const simbolo = this.simbolos.get(chave);
            if (simbolo) return simbolo;
            partes.pop();
        }

        return null;
    }

    estaInicializado(simbolo, escopoDeUso) {
        if (!simbolo) return false;
        if (simbolo.categoria === 'parametro') return true;

        // O corpo de um procedimento pode ser executado depois de o programa
        // principal inicializar uma variável externa. Sem uma árvore de fluxo
        // de chamadas, acusar esse caso como "uso antes da inicialização"
        // produziria um falso positivo. A validação final ainda garante que a
        // variável externa recebeu valor em seu próprio escopo.
        if (simbolo.escopo !== escopoDeUso) return true;

        return Boolean(this.inicializados.get(simbolo.chave));
    }

    marcarInicializado(simbolo, escopoDoComando) {
        if (!simbolo || simbolo.categoria === 'procedimento') return;

        // Uma atribuição feita dentro de um procedimento não prova que uma
        // variável de um escopo externo sempre será inicializada.
        if (simbolo.escopo !== escopoDoComando) return;

        this.inicializados.set(simbolo.chave, true);
    }

    tipoDoIdentificador(nome, escopo, linha, contexto) {
        const simbolo = this.resolverSimbolo(nome, escopo);

        if (!simbolo) {
            this.adicionarErro(
                'IDENTIFICADOR_NAO_DECLARADO',
                linha,
                `O identificador "${nome}" não foi declarado.`,
                { nome, escopo }
            );
            return TIPOS.ERRO;
        }

        if (simbolo.categoria === 'procedimento') {
            this.adicionarErro(
                'PROCEDIMENTO_USADO_COMO_VALOR',
                linha,
                `O procedimento "${nome}" não pode ser usado como valor.`,
                { nome, escopo }
            );
            return TIPOS.ERRO;
        }

        if (this.opcoes.exigirInicializacao && !this.estaInicializado(simbolo, escopo)) {
            this.adicionarErro(
                'USO_ANTES_DA_INICIALIZACAO',
                linha,
                `A variável "${nome}" foi usada antes de ser inicializada.`,
                { nome, escopo, contexto }
            );
        }

        return simbolo.tipo;
    }

    tiposCompativeis(tipoDestino, tipoOrigem) {
        if (tipoDestino === TIPOS.ERRO || tipoOrigem === TIPOS.ERRO) return false;
        if (tipoDestino === tipoOrigem) return true;

        // A promoção de integer para real não perde informação.
        return tipoDestino === TIPOS.REAL && tipoOrigem === TIPOS.INTEIRO;
    }

    avaliarExpressao(expressao, escopo, contexto = 'expressao') {
        return new AvaliadorExpressao(this, expressao, escopo, contexto).avaliar();
    }

    verificarChamada(nome, argumentos, escopo, linha, emExpressao = false) {
        const simbolo = this.resolverSimbolo(nome, escopo);

        if (!simbolo) {
            this.adicionarErro(
                'PROCEDIMENTO_NAO_DECLARADO',
                linha,
                `O procedimento "${nome}" não foi declarado.`,
                { nome, escopo }
            );
            return;
        }

        if (simbolo.categoria !== 'procedimento') {
            this.adicionarErro(
                'IDENTIFICADOR_NAO_E_PROCEDIMENTO',
                linha,
                `O identificador "${nome}" não é um procedimento.`,
                { nome, escopo }
            );
            return;
        }

        const parametros = simbolo.parametros ?? [];
        if (argumentos.length !== parametros.length) {
            this.adicionarErro(
                'QUANTIDADE_ARGUMENTOS_INVALIDA',
                linha,
                `O procedimento "${nome}" espera ${parametros.length} argumento(s), mas recebeu ${argumentos.length}.`,
                { nome, esperado: parametros.length, recebido: argumentos.length }
            );
        }

        const quantidade = Math.min(argumentos.length, parametros.length);
        for (let indice = 0; indice < quantidade; indice++) {
            const argumento = argumentos[indice];
            const tipoParametro = normalizarTipo(parametros[indice].tipo);

            if (
                argumento.tipo !== TIPOS.ERRO &&
                !this.tiposCompativeis(tipoParametro, argumento.tipo)
            ) {
                this.adicionarErro(
                    'TIPO_ARGUMENTO_INVALIDO',
                    argumento.linha ?? linha,
                    `O argumento ${indice + 1} de "${nome}" deve ser ${tipoLegivel(tipoParametro)}, mas recebeu ${tipoLegivel(argumento.tipo)}.`,
                    {
                        nome,
                        argumento: indice + 1,
                        esperado: tipoParametro,
                        recebido: argumento.tipo
                    }
                );
            }
        }

        if (emExpressao) {
            this.adicionarErro(
                'PROCEDIMENTO_SEM_RETORNO',
                linha,
                `O procedimento "${nome}" não retorna um valor e não pode fazer parte de uma expressão.`,
                { nome, escopo }
            );
        }
    }

    analisarInicializacoes() {
        const declaracoes = Array.isArray(this.tabela?.declaracoes)
            ? this.tabela.declaracoes
            : [];

        for (const declaracao of declaracoes) {
            if (!declaracao?.inicializacao) continue;

            const simbolo = this.simbolos.get(
                declaracao.chave ??
                chaveDoSimbolo(declaracao.nome, declaracao.escopo ?? 'global')
            );
            if (!simbolo) continue;

            const tipoExpressao = this.avaliarExpressao(
                declaracao.inicializacao,
                declaracao.escopo ?? 'global',
                'inicializacao'
            );

            if (tipoExpressao === TIPOS.ERRO) continue;

            if (!this.tiposCompativeis(simbolo.tipo, tipoExpressao)) {
                this.adicionarErro(
                    'TIPO_INICIALIZACAO_INVALIDO',
                    declaracao.linha,
                    `A variável "${declaracao.nome}" é ${tipoLegivel(simbolo.tipo)}, mas foi inicializada com ${tipoLegivel(tipoExpressao)}.`,
                    {
                        nome: declaracao.nome,
                        esperado: simbolo.tipo,
                        recebido: tipoExpressao
                    }
                );
                continue;
            }

            this.inicializados.set(simbolo.chave, true);
        }
    }

    analisarAtribuicao(comando, escopo) {
        const simbolo = this.resolverSimbolo(comando.alvo, escopo);
        const tipoExpressao = this.avaliarExpressao(
            comando.expressao,
            escopo,
            'atribuicao'
        );

        if (!simbolo) {
            this.adicionarErro(
                'IDENTIFICADOR_NAO_DECLARADO',
                comando.linha,
                `O identificador "${comando.alvo}" não foi declarado.`,
                { nome: comando.alvo, escopo }
            );
            return;
        }

        if (simbolo.categoria === 'procedimento') {
            this.adicionarErro(
                'ATRIBUICAO_EM_PROCEDIMENTO',
                comando.linha,
                `Não é possível atribuir um valor ao procedimento "${comando.alvo}".`,
                { nome: comando.alvo, escopo }
            );
            return;
        }

        if (tipoExpressao === TIPOS.ERRO) return;

        if (!this.tiposCompativeis(simbolo.tipo, tipoExpressao)) {
            this.adicionarErro(
                'TIPO_ATRIBUICAO_INVALIDO',
                comando.linha,
                `A variável "${comando.alvo}" é ${tipoLegivel(simbolo.tipo)}, mas a expressão é ${tipoLegivel(tipoExpressao)}.`,
                {
                    nome: comando.alvo,
                    esperado: simbolo.tipo,
                    recebido: tipoExpressao
                }
            );
            return;
        }

        this.marcarInicializado(simbolo, escopo);
    }

    analisarChamada(comando, escopo) {
        const argumentos = (comando.argumentos ?? []).map((argumento) => ({
            tipo: this.avaliarExpressao(argumento, escopo, 'argumento'),
            linha: argumento?.tokens?.[0]?.linha ?? comando.linha
        }));

        this.verificarChamada(
            comando.nome,
            argumentos,
            escopo,
            comando.linha,
            false
        );
    }

    analisarCondicao(comando, escopo) {
        const tipo = this.avaliarExpressao(comando.condicao, escopo, 'condicao');

        if (tipo !== TIPOS.ERRO && tipo !== TIPOS.BOOLEANO) {
            this.adicionarErro(
                'CONDICAO_NAO_BOOLEANA',
                comando.linha,
                `A condição de "${comando.tipo}" deve ser boolean, mas recebeu ${tipoLegivel(tipo)}.`,
                { comando: comando.tipo, recebido: tipo }
            );
        }
    }

    analisarWrite(comando, escopo) {
        const tipos = [];
        for (const argumento of comando.argumentos ?? []) {
            const tipo = this.avaliarExpressao(argumento, escopo, 'write');
            if (tipo !== TIPOS.ERRO) tipos.push(tipo);
        }

        if (new Set(tipos).size > 1) {
            this.adicionarErro(
                'TIPOS_DIFERENTES_NA_SAIDA',
                comando.linha,
                'Todas as variáveis ou expressões de um mesmo comando de saída devem possuir o mesmo tipo.'
            );
        }
    }

    analisarRead(comando, escopo) {
        const tipos = [];
        for (const identificador of comando.identificadores ?? []) {
            const simbolo = this.resolverSimbolo(identificador.nome, escopo);

            if (!simbolo) {
                this.adicionarErro(
                    'IDENTIFICADOR_NAO_DECLARADO',
                    identificador.linha ?? comando.linha,
                    `O identificador "${identificador.nome}" não foi declarado.`,
                    { nome: identificador.nome, escopo }
                );
                continue;
            }

            if (simbolo.categoria === 'procedimento') {
                this.adicionarErro(
                    'LEITURA_EM_PROCEDIMENTO',
                    identificador.linha ?? comando.linha,
                    `Não é possível armazenar uma leitura no procedimento "${identificador.nome}".`,
                    { nome: identificador.nome, escopo }
                );
                continue;
            }

            tipos.push(simbolo.tipo);
            this.marcarInicializado(simbolo, escopo);
        }

        if (new Set(tipos).size > 1) {
            this.adicionarErro(
                'TIPOS_DIFERENTES_NA_ENTRADA',
                comando.linha,
                'Todas as variáveis de um mesmo comando de entrada devem possuir o mesmo tipo.'
            );
        }
    }

    analisarComandos() {
        const comandos = Array.isArray(this.tabela?.comandos)
            ? this.tabela.comandos
            : [];
        const porEscopo = new Map();

        for (const comando of comandos) {
            const escopo = comando?.escopo ?? 'global';
            if (!porEscopo.has(escopo)) porEscopo.set(escopo, []);
            porEscopo.get(escopo).push(comando);
        }

        const escopos = [...porEscopo.keys()].sort((a, b) => {
            const profundidade = a.split('.').length - b.split('.').length;
            return profundidade || a.localeCompare(b);
        });

        for (const escopo of escopos) {
            for (const comando of porEscopo.get(escopo)) {
                switch (comando?.tipo) {
                    case 'atribuicao':
                        this.analisarAtribuicao(comando, escopo);
                        break;
                    case 'chamada':
                        this.analisarChamada(comando, escopo);
                        break;
                    case 'if':
                    case 'while':
                        this.analisarCondicao(comando, escopo);
                        break;
                    case 'write':
                        this.analisarWrite(comando, escopo);
                        break;
                    case 'read':
                        this.analisarRead(comando, escopo);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    verificarVariaveisNaoInicializadas() {
        if (!this.opcoes.exigirInicializacao) return;

        for (const simbolo of this.simbolos.values()) {
            if (simbolo.categoria !== 'variavel') continue;
            if (this.inicializados.get(simbolo.chave)) continue;

            this.adicionarErro(
                'VARIAVEL_NAO_INICIALIZADA',
                simbolo.linha,
                `A variável "${simbolo.nome}" foi declarada, mas não foi inicializada.`,
                { nome: simbolo.nome, escopo: simbolo.escopo }
            );
        }
    }

    verificarVariaveisNaoUtilizadas() {
        for (const uso of this.tabela?.usos ?? []) {
            const simbolo = this.resolverSimbolo(uso.nome, uso.escopo ?? 'global');
            if (simbolo) this.utilizados.add(simbolo.chave);
        }

        for (const simbolo of this.simbolos.values()) {
            if (simbolo.categoria !== 'variavel' || this.utilizados.has(simbolo.chave)) continue;
            this.adicionarErro(
                'VARIAVEL_NAO_UTILIZADA',
                simbolo.linha,
                `A variável "${simbolo.nome}" foi declarada, mas nunca foi utilizada.`,
                { nome: simbolo.nome, escopo: simbolo.escopo }
            );
        }
    }

    tabelaSimbolosResultado() {
        return Object.fromEntries(
            [...this.simbolos.entries()].map(([chave, simbolo]) => [
                chave,
                {
                    ...simbolo,
                    inicializado: Boolean(this.inicializados.get(chave)),
                    utilizada: simbolo.categoria === 'programa' || this.utilizados.has(chave)
                }
            ])
        );
    }

    resultado(analisado) {
        return {
            sucesso: analisado &&
                this.errosSintaticos.length === 0 &&
                this.erros.length === 0,
            analisado,
            erros: this.erros.map((erro) => erro.mensagem),
            errosSemanticos: this.erros,
            errosSintaticos: this.errosSintaticos,
            avisos: this.avisos,
            tabelaSimbolos: this.tabelaSimbolosResultado()
        };
    }

    analisar() {
        if (!this.tabela) {
            this.adicionarErro(
                'ENTRADA_INVALIDA',
                null,
                'O analisador semântico esperava o resultado do Parser ou uma tabela sintática.'
            );
            return this.resultado(false);
        }

        if (
            this.errosSintaticos.length > 0 &&
            !this.opcoes.analisarComErrosSintaticos
        ) {
            return this.resultado(false);
        }

        this.montarTabelaSimbolos();
        this.analisarInicializacoes();
        this.analisarComandos();
        this.verificarVariaveisNaoInicializadas();
        this.verificarVariaveisNaoUtilizadas();
        return this.resultado(true);
    }
}

/**
 * Executa a análise semântica sobre o retorno de Parser.analisar() ou sobre
 * sua propriedade tabelaSintatica.
 *
 * O Parser atual também chama esta função com uma mensagem quando encontra
 * um erro sintático. Esse formato é aceito para manter a integração existente
 * sem tentar executar análise semântica sobre uma árvore incompleta.
 */
export function semantico(entrada, opcoes = {}) {
    if (typeof entrada === 'string') {
        return {
            sucesso: false,
            analisado: false,
            erros: [],
            errosSemanticos: [],
            errosSintaticos: [entrada],
            avisos: [],
            tabelaSimbolos: {}
        };
    }

    return new AnalisadorSemantico(entrada, opcoes).analisar();
}

export default semantico;
