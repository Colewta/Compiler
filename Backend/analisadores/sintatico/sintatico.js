export class Parser {
    constructor(tokens) {
        this.tokens = tokens ?? [];
        this.ptr = 0;
        this.erros = [];
        this.errosSintaticos = [];
        this.escopos = ['global'];
        this.tabelaSintatica = {
            programa: null,
            tabelaTipos: {},
            simbolos: {},
            declaracoes: [],
            procedimentos: [],
            comandos: [],
            usos: [],
            erros: this.errosSintaticos
        };
        this.arvoreSintatica = {
            tipo: 'Programa',
            nome: null,
            declaracoes: [],
            procedimentos: [],
            comandos: [],
            erros: this.errosSintaticos
        };
    }

    atualizarPonteiro() {
        if (!this.fim()) this.ptr++;
    }

    atual() {
        return this.tokens[this.ptr] ?? {
            tipo: 'EOF',
            valor: 'fim do arquivo',
            linha: this.tokens[this.tokens.length - 1]?.linha ?? 1
        };
    }

    anterior() {
        return this.tokens[this.ptr - 1] ?? this.atual();
    }

    escopoAtual() {
        return this.escopos.join('.');
    }

    entrarEscopo(nome) {
        if (nome) this.escopos.push(nome);
    }

    sairEscopo() {
        if (this.escopos.length > 1) this.escopos.pop();
    }

    chaveSimbolo(nome, escopo = this.escopoAtual()) {
        return escopo === 'global' ? nome : `${escopo}.${nome}`;
    }

    tokenParaEntrada(token) {
        if (!token) return null;
        return {
            tipo: token.tipo,
            valor: token.valor,
            linha: token.linha
        };
    }

    tokensParaTexto(tokens) {
        return tokens
            .map((token) => token.valor)
            .join(' ')
            .replace(/\s+([,;:)])/g, '$1')
            .replace(/([(])\s+/g, '$1');
    }

    registrarSimbolo(token, tipo, categoria, extra = {}) {
        if (!token || token.tipo !== 'IDENTIFICADOR') return null;

        const escopo = this.escopoAtual();
        const chave = this.chaveSimbolo(token.valor, escopo);
        const simbolo = {
            nome: token.valor,
            tipo,
            categoria,
            escopo,
            chave,
            linha: token.linha,
            ...extra
        };

        this.tabelaSintatica.simbolos[chave] = simbolo;
        if (tipo) {
            this.tabelaSintatica.tabelaTipos[chave] = tipo;
            if (!this.tabelaSintatica.tabelaTipos[token.valor]) {
                this.tabelaSintatica.tabelaTipos[token.valor] = tipo;
            }
        }

        return simbolo;
    }

    registrarDeclaracao(tipo, identificadores, categoria = 'variavel') {
        const declaracoes = [];

        for (const identificador of identificadores) {
            const token = identificador.token ?? identificador;
            if (!token || token.tipo !== 'IDENTIFICADOR') continue;

            const simbolo = this.registrarSimbolo(token, tipo, categoria, {
                inicializado: Boolean(identificador.inicializacao),
                inicializacao: identificador.inicializacao ?? null
            });

            const declaracao = {
                nome: token.valor,
                tipo,
                categoria,
                escopo: this.escopoAtual(),
                linha: token.linha,
                inicializacao: identificador.inicializacao ?? null
            };

            declaracoes.push(declaracao);
            this.tabelaSintatica.declaracoes.push(declaracao);
            this.arvoreSintatica.declaracoes.push(declaracao);

            if (simbolo) declaracao.chave = simbolo.chave;
        }

        return declaracoes;
    }

    registrarUso(token, contexto) {
        if (!token || token.tipo !== 'IDENTIFICADOR') return null;

        const uso = {
            nome: token.valor,
            escopo: this.escopoAtual(),
            linha: token.linha,
            contexto
        };

        this.tabelaSintatica.usos.push(uso);
        return uso;
    }

    registrarComando(comando) {
        const comandoCompleto = {
            escopo: this.escopoAtual(),
            ...comando
        };

        this.tabelaSintatica.comandos.push(comandoCompleto);
        this.arvoreSintatica.comandos.push(comandoCompleto);
        return comandoCompleto;
    }

    criarExpressao(inicio, fim, contexto = 'expressao') {
        const tokens = this.tokens.slice(inicio, fim).map((token) => this.tokenParaEntrada(token));
        const referencias = tokens
            .filter((token) => token.tipo === 'IDENTIFICADOR')
            .map((token) => {
                this.registrarUso(token, contexto);
                return {
                    nome: token.valor,
                    linha: token.linha
                };
            });

        return {
            texto: this.tokensParaTexto(tokens),
            tokens,
            referencias
        };
    }

    fim() {
        return this.ptr >= this.tokens.length;
    }

    criaErro(linha, valorEsperado = null, valor = null) {
        const mensagem = valorEsperado && valor
            ? `Erro sintatico na linha ${linha}: Esperado "${valorEsperado}", encontrado "${valor}".`
            : `Erro sintatico na linha ${linha}`;

        this.erros.push(mensagem);
        this.errosSintaticos.push({
            linha,
            esperado: valorEsperado,
            encontrado: valor,
            mensagem
        });
    }

    erroAtual(valorEsperado) {
        const token = this.atual();
        this.criaErro(token.linha, valorEsperado, token.valor);
    }

    verificar(tipoEsperado, valorEsperado = null) {
        const token = this.atual();
        if (token.tipo !== tipoEsperado) return false;
        return valorEsperado === null || token.valor === valorEsperado;
    }

    verificarValor(valorEsperado) {
        return this.atual().valor === valorEsperado;
    }

    verificarTipoDado() {
        return this.verificar('TIPO_DADO');
    }

    combinar(tipoEsperado, valorEsperado = null) {
        if (!this.verificar(tipoEsperado, valorEsperado)) return false;
        this.atualizarPonteiro();
        return true;
    }

    // Recebe um tipo ou valor do token e compara com o que era esperado.
    consumir(tipoEsperado, valorEsperado = null, sincronizacao = []) {
        if (this.combinar(tipoEsperado, valorEsperado)) return true;

        this.erroAtual(valorEsperado ?? tipoEsperado);
        if (sincronizacao.length > 0) this.sincronizar(sincronizacao);
        else if (!this.fim()) this.atualizarPonteiro();

        return false;
    }

    pontoSincronizacao(token, pontos) {
        return pontos.some((ponto) => token.tipo === ponto || token.valor === ponto);
    }

    sincronizar(pontos) {
        while (!this.fim() && !this.pontoSincronizacao(this.atual(), pontos)) {
            this.atualizarPonteiro();
        }
    }

    inicioComando() {
        const token = this.atual();
        if (token.tipo === 'IDENTIFICADOR') return true;
        if (token.tipo === 'PALAVRA_RESERVADA') {
            return ['begin', 'write', 'read'].includes(token.valor);
        }
        if (token.tipo === 'CONTROLE_FLUXO') {
            return ['if', 'while'].includes(token.valor);
        }
        return false;
    }

    terminadorComando(terminadores) {
        const token = this.atual();
        return terminadores.some((terminador) => token.tipo === terminador || token.valor === terminador);
    }

    // Declaracao no estilo: int alfa, beta; / boolean omega;
    // Tambem aceita: alfa, beta: int;
    tipoDado() {
        this.declaracaoVariavel(false);
    }

    declaracoesVariaveis() {
        if (this.combinar('PALAVRA_RESERVADA', 'var')) {
            while (!this.fim() && !this.verificar('PALAVRA_RESERVADA', 'begin') && !this.verificar('PALAVRA_RESERVADA', 'procedure')) {
                if (!this.verificarTipoDado() && !this.verificar('IDENTIFICADOR')) {
                    this.erroAtual('declaracao de variavel');
                    this.sincronizar(['PONTO_E_VIRGULA', 'begin', 'procedure']);
                    this.combinar('PONTO_E_VIRGULA');
                    continue;
                }
                this.declaracaoVariavel(true);
            }
            return;
        }

        while (this.verificarTipoDado()) {
            this.declaracaoVariavel(false);
        }
    }

    declaracaoVariavel(aceitaEstiloPascal) {
        if (this.verificarTipoDado()) {
            const tipoToken = this.atual();
            this.atualizarPonteiro();
            const identificadores = this.listaIdentificadoresComInicializacao();
            this.registrarDeclaracao(tipoToken.valor, identificadores);
            this.consumir('PONTO_E_VIRGULA', null, ['TIPO_DADO', 'IDENTIFICADOR', 'procedure', 'begin']);
            return;
        }

        if (aceitaEstiloPascal && this.verificar('IDENTIFICADOR')) {
            const identificadores = this.listaIdentificadores().map((token) => ({ token }));
            this.consumir('DOIS_PONTOS', null, ['TIPO_DADO', 'PONTO_E_VIRGULA']);
            const tipoToken = this.atual();
            if (this.consumir('TIPO_DADO', null, ['PONTO_E_VIRGULA', 'begin', 'procedure'])) {
                this.registrarDeclaracao(tipoToken.valor, identificadores);
            }
            this.consumir('PONTO_E_VIRGULA', null, ['IDENTIFICADOR', 'TIPO_DADO', 'procedure', 'begin']);
            return;
        }

        this.erroAtual('tipo de dado');
        this.sincronizar(['PONTO_E_VIRGULA', 'begin', 'procedure']);
        this.combinar('PONTO_E_VIRGULA');
    }

    listaIdentificadoresComInicializacao() {
        const identificadores = [];
        let identificadorAtual = null;

        if (this.verificar('IDENTIFICADOR')) {
            const token = this.atual();
            this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'OPERADOR_ATRIBUICAO', 'PONTO_E_VIRGULA']);
            identificadorAtual = { token, inicializacao: null };
            identificadores.push(identificadorAtual);
        } else {
            this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'OPERADOR_ATRIBUICAO', 'PONTO_E_VIRGULA']);
        }

        if (this.combinar('OPERADOR_ATRIBUICAO')) {
            const inicioExpressao = this.ptr;
            this.expressao(['VIRGULA', 'PONTO_E_VIRGULA']);
            if (identificadorAtual) {
                identificadorAtual.inicializacao = this.criarExpressao(inicioExpressao, this.ptr, 'inicializacao');
            }
        }

        while (this.combinar('VIRGULA')) {
            identificadorAtual = null;

            if (this.verificar('IDENTIFICADOR')) {
                const token = this.atual();
                this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'OPERADOR_ATRIBUICAO', 'PONTO_E_VIRGULA']);
                identificadorAtual = { token, inicializacao: null };
                identificadores.push(identificadorAtual);
            } else {
                this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'OPERADOR_ATRIBUICAO', 'PONTO_E_VIRGULA']);
            }

            if (this.combinar('OPERADOR_ATRIBUICAO')) {
                const inicioExpressao = this.ptr;
                this.expressao(['VIRGULA', 'PONTO_E_VIRGULA']);
                if (identificadorAtual) {
                    identificadorAtual.inicializacao = this.criarExpressao(inicioExpressao, this.ptr, 'inicializacao');
                }
            }
        }

        return identificadores;
    }

    listaIdentificadores() {
        const identificadores = [];

        if (this.verificar('IDENTIFICADOR')) {
            const token = this.atual();
            this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'DOIS_PONTOS', 'PONTO_E_VIRGULA', 'FECHA_PARENTESIS']);
            identificadores.push(token);
        } else {
            this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'DOIS_PONTOS', 'PONTO_E_VIRGULA', 'FECHA_PARENTESIS']);
        }

        while (this.combinar('VIRGULA')) {
            if (this.verificar('IDENTIFICADOR')) {
                const token = this.atual();
                this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'DOIS_PONTOS', 'PONTO_E_VIRGULA', 'FECHA_PARENTESIS']);
                identificadores.push(token);
            } else {
                this.consumir('IDENTIFICADOR', null, ['VIRGULA', 'DOIS_PONTOS', 'PONTO_E_VIRGULA', 'FECHA_PARENTESIS']);
            }
        }

        return identificadores;
    }

    declaracoesProcedimentos() {
        while (this.combinar('PALAVRA_RESERVADA', 'procedure')) {
            const nomeToken = this.atual();
            const nomeValido = this.consumir('IDENTIFICADOR', null, ['ABRE_PARENTESIS', 'PONTO_E_VIRGULA']);
            const nomeProcedimento = nomeValido ? nomeToken.valor : '<procedimento>';
            const simboloProcedimento = nomeValido
                ? this.registrarSimbolo(nomeToken, 'procedure', 'procedimento', { parametros: [] })
                : null;
            const procedimento = {
                nome: nomeProcedimento,
                escopo: this.escopoAtual(),
                linha: nomeToken.linha,
                parametros: [],
                declaracoes: [],
                comandos: []
            };

            this.tabelaSintatica.procedimentos.push(procedimento);
            this.arvoreSintatica.procedimentos.push(procedimento);
            this.entrarEscopo(nomeProcedimento);

            if (this.combinar('ABRE_PARENTESIS')) {
                procedimento.parametros = this.parametrosProcedimento();
                if (simboloProcedimento) simboloProcedimento.parametros = procedimento.parametros;
                this.consumir('FECHA_PARENTESIS', null, ['PONTO_E_VIRGULA']);
            }

            this.consumir('PONTO_E_VIRGULA', null, ['var', 'TIPO_DADO', 'procedure', 'begin']);
            this.bloco();
            procedimento.declaracoes = this.tabelaSintatica.declaracoes.filter((declaracao) => declaracao.escopo === this.escopoAtual());
            procedimento.comandos = this.tabelaSintatica.comandos.filter((comando) => comando.escopo === this.escopoAtual());
            this.sairEscopo();
            this.consumir('PONTO_E_VIRGULA', null, ['procedure', 'begin', 'PONTO_FINAL']);
        }
    }

    parametrosProcedimento() {
        const parametros = [];

        if (this.verificar('FECHA_PARENTESIS')) return parametros;

        do {
            const identificadores = this.listaIdentificadores();
            this.consumir('DOIS_PONTOS', null, ['TIPO_DADO', 'PONTO_E_VIRGULA', 'FECHA_PARENTESIS']);
            const tipoToken = this.atual();
            if (this.consumir('TIPO_DADO', null, ['PONTO_E_VIRGULA', 'FECHA_PARENTESIS'])) {
                for (const identificador of identificadores) {
                    const parametro = {
                        nome: identificador.valor,
                        tipo: tipoToken.valor,
                        escopo: this.escopoAtual(),
                        linha: identificador.linha
                    };
                    parametros.push(parametro);
                    this.registrarDeclaracao(tipoToken.valor, [{ token: identificador }], 'parametro');
                }
            }
        } while (this.combinar('PONTO_E_VIRGULA'));

        return parametros;
    }

    bloco() {
        this.declaracoesVariaveis();
        this.declaracoesProcedimentos();
        this.comandoComposto();
    }

    corpo() {
        this.bloco();
    }

    comandoComposto() {
        this.consumir('PALAVRA_RESERVADA', 'begin', ['IDENTIFICADOR', 'if', 'while', 'write', 'read', 'end']);
        this.listaComandos(['end']);
        this.consumir('PALAVRA_RESERVADA', 'end', ['PONTO_E_VIRGULA', 'PONTO_FINAL', 'else']);
    }

    listaComandos(terminadores) {
        while (!this.fim() && !this.terminadorComando(terminadores)) {
            if (this.combinar('PONTO_E_VIRGULA')) continue;

            const iniciouComando = this.comando(terminadores);
            if (!iniciouComando) continue;

            if (this.combinar('PONTO_E_VIRGULA')) {
                while (this.combinar('PONTO_E_VIRGULA')) {}
                continue;
            }

            if (!this.fim() && !this.terminadorComando(terminadores)) {
                this.erroAtual('PONTO_E_VIRGULA');
                this.sincronizar(['PONTO_E_VIRGULA', 'begin', 'if', 'while', 'write', 'read', 'else', 'end']);
                this.combinar('PONTO_E_VIRGULA');
            }
        }
    }

    comando(terminadores = ['end']) {
        if (this.verificar('PALAVRA_RESERVADA', 'begin')) {
            this.comandoComposto();
            return true;
        }

        if (this.verificar('IDENTIFICADOR')) {
            this.atribuicaoOuChamada();
            return true;
        }

        if (this.verificar('CONTROLE_FLUXO', 'if')) {
            this.comandoIf();
            return true;
        }

        if (this.verificar('CONTROLE_FLUXO', 'while')) {
            this.comandoWhile();
            return true;
        }

        if (this.verificar('PALAVRA_RESERVADA', 'write')) {
            this.comandoWrite();
            return true;
        }

        if (this.verificar('PALAVRA_RESERVADA', 'read')) {
            this.comandoRead();
            return true;
        }

        if (this.verificar('PALAVRA_RESERVADA', 'return')) {
            this.erroAtual('comando valido (return nao e permitido)');
            this.atualizarPonteiro();
            if (!this.verificar('PONTO_E_VIRGULA') && !this.terminadorComando(terminadores)) {
                this.expressao(['PONTO_E_VIRGULA', 'end', 'else']);
            }
            return true;
        }

        if (this.terminadorComando(terminadores) || this.verificar('PALAVRA_RESERVADA', 'end')) {
            return false;
        }

        this.erroAtual('comando');
        this.atualizarPonteiro();
        return false;
    }

    atribuicaoOuChamada() {
        const identificador = this.atual();
        this.consumir('IDENTIFICADOR');

        if (this.combinar('OPERADOR_ATRIBUICAO')) {
            const inicioExpressao = this.ptr;
            this.expressao(['PONTO_E_VIRGULA', 'begin', 'if', 'while', 'write', 'read', 'end', 'else']);
            const expressao = this.criarExpressao(inicioExpressao, this.ptr, 'atribuicao');
            this.registrarUso(identificador, 'atribuicao');
            this.registrarComando({
                tipo: 'atribuicao',
                alvo: identificador.valor,
                linha: identificador.linha,
                expressao
            });
            return;
        }

        if (this.combinar('ABRE_PARENTESIS')) {
            const argumentos = this.argumentosChamada();
            this.consumir('FECHA_PARENTESIS', null, ['PONTO_E_VIRGULA', 'end', 'else']);
            this.registrarUso(identificador, 'chamada');
            this.registrarComando({
                tipo: 'chamada',
                nome: identificador.valor,
                linha: identificador.linha,
                argumentos
            });
            return;
        }

        this.erroAtual('OPERADOR_ATRIBUICAO ou ABRE_PARENTESIS');
        this.sincronizar(['PONTO_E_VIRGULA', 'end', 'else']);
    }

    argumentosChamada() {
        const argumentos = [];

        if (this.verificar('FECHA_PARENTESIS')) return argumentos;

        do {
            const inicioExpressao = this.ptr;
            this.expressao(['VIRGULA', 'FECHA_PARENTESIS']);
            argumentos.push(this.criarExpressao(inicioExpressao, this.ptr, 'argumento'));
        } while (this.combinar('VIRGULA'));

        return argumentos;
    }

    comandoIf() {
        const linha = this.atual().linha;
        this.consumir('CONTROLE_FLUXO', 'if');
        const condicao = this.condicao(['then']);
        this.registrarComando({
            tipo: 'if',
            linha,
            condicao
        });

        if (!this.consumir('CONTROLE_FLUXO', 'then', ['begin', 'if', 'while', 'write', 'read', 'IDENTIFICADOR', 'else', 'end'])) {
            if (this.verificar('CONTROLE_FLUXO', 'else') || this.verificar('PALAVRA_RESERVADA', 'end')) return;
        }

        if (this.inicioComando()) this.comando(['else', 'end']);
        else this.erroAtual('comando apos then');

        if (this.combinar('CONTROLE_FLUXO', 'else')) {
            if (this.inicioComando()) this.comando(['end']);
            else this.erroAtual('comando apos else');
        }
    }

    comandoWhile() {
        const linha = this.atual().linha;
        this.consumir('CONTROLE_FLUXO', 'while');
        const condicao = this.condicao(['do']);
        this.registrarComando({
            tipo: 'while',
            linha,
            condicao
        });
        this.consumir('CONTROLE_FLUXO', 'do', ['begin', 'if', 'while', 'write', 'read', 'IDENTIFICADOR', 'end']);

        if (this.inicioComando()) this.comando(['end']);
        else this.erroAtual('comando apos do');
    }

    condicao(delimitadores) {
        if (this.combinar('ABRE_PARENTESIS')) {
            const inicioExpressao = this.ptr;
            this.expressao(['FECHA_PARENTESIS']);
            const expressao = this.criarExpressao(inicioExpressao, this.ptr, 'condicao');
            this.consumir('FECHA_PARENTESIS', null, delimitadores);
            return expressao;
        }

        const inicioExpressao = this.ptr;
        this.expressao(delimitadores);
        return this.criarExpressao(inicioExpressao, this.ptr, 'condicao');
    }

    comandoWrite() {
        const linha = this.atual().linha;
        const argumentos = [];
        this.consumir('PALAVRA_RESERVADA', 'write');
        this.consumir('ABRE_PARENTESIS', null, ['IDENTIFICADOR', 'NUMERO', 'STRING', 'true', 'false', 'FECHA_PARENTESIS']);

        if (!this.verificar('FECHA_PARENTESIS')) {
            do {
                const inicioExpressao = this.ptr;
                this.expressao(['VIRGULA', 'FECHA_PARENTESIS']);
                argumentos.push(this.criarExpressao(inicioExpressao, this.ptr, 'write'));
            } while (this.combinar('VIRGULA'));
        }

        this.consumir('FECHA_PARENTESIS', null, ['PONTO_E_VIRGULA', 'end', 'else']);
        this.registrarComando({
            tipo: 'write',
            linha,
            argumentos
        });
    }

    comandoRead() {
        const linha = this.atual().linha;
        let identificadores = [];
        this.consumir('PALAVRA_RESERVADA', 'read');
        this.consumir('ABRE_PARENTESIS', null, ['IDENTIFICADOR', 'FECHA_PARENTESIS']);

        if (!this.verificar('FECHA_PARENTESIS')) {
            identificadores = this.listaIdentificadores();
            identificadores.forEach((identificador) => this.registrarUso(identificador, 'read'));
        }

        this.consumir('FECHA_PARENTESIS', null, ['PONTO_E_VIRGULA', 'end', 'else']);
        this.registrarComando({
            tipo: 'read',
            linha,
            identificadores: identificadores.map((identificador) => ({
                nome: identificador.valor,
                linha: identificador.linha
            }))
        });
    }

    delimitadorExpressao(token, delimitadores) {
        return delimitadores.some((delimitador) => token.tipo === delimitador || token.valor === delimitador);
    }

    expressao(delimitadores = []) {
        const inicio = this.ptr;
        const valido = this.expressaoOu(delimitadores);

        if (this.ptr === inicio || !valido) {
            this.erroAtual('expressao');
            this.sincronizar(delimitadores);
            return false;
        }

        if (!this.fim() && !this.delimitadorExpressao(this.atual(), delimitadores)) {
            this.erroAtual('operador ou fim de expressao');
            this.sincronizar(delimitadores);
            return false;
        }

        return true;
    }

    expressaoOu(delimitadores) {
        let valido = this.expressaoE(delimitadores);
        while (this.verificar('OPERADOR_LOGICO', 'or') || this.verificar('OPERADOR_LOGICO', '||')) {
            this.atualizarPonteiro();
            valido = this.expressaoE(delimitadores) && valido;
        }
        return valido;
    }

    expressaoE(delimitadores) {
        let valido = this.expressaoRelacional(delimitadores);
        while (this.verificar('OPERADOR_LOGICO', 'and') || this.verificar('OPERADOR_LOGICO', '&&')) {
            this.atualizarPonteiro();
            valido = this.expressaoRelacional(delimitadores) && valido;
        }
        return valido;
    }

    expressaoRelacional(delimitadores) {
        let valido = this.expressaoAditiva(delimitadores);
        while (this.verificar('OPERADOR_RELACIONAL')) {
            this.atualizarPonteiro();
            valido = this.expressaoAditiva(delimitadores) && valido;
        }
        return valido;
    }

    expressaoAditiva(delimitadores) {
        let valido = this.expressaoMultiplicativa(delimitadores);
        while (this.verificar('OPERADOR_MATEMATICO', '+') || this.verificar('OPERADOR_MATEMATICO', '-')) {
            this.atualizarPonteiro();
            valido = this.expressaoMultiplicativa(delimitadores) && valido;
        }
        return valido;
    }

    expressaoMultiplicativa(delimitadores) {
        let valido = this.expressaoUnaria(delimitadores);
        while (this.verificar('OPERADOR_MATEMATICO', '*') || this.verificar('OPERADOR_MATEMATICO', '/')) {
            this.atualizarPonteiro();
            valido = this.expressaoUnaria(delimitadores) && valido;
        }
        return valido;
    }

    expressaoUnaria(delimitadores) {
        if (this.verificar('OPERADOR_LOGICO', '!') || this.verificar('OPERADOR_LOGICO', 'not') || this.verificar('OPERADOR_MATEMATICO', '+') || this.verificar('OPERADOR_MATEMATICO', '-')) {
            this.atualizarPonteiro();
            return this.expressaoUnaria(delimitadores);
        }

        return this.expressaoPrimaria(delimitadores);
    }

    expressaoPrimaria(delimitadores) {
        if (this.fim() || this.delimitadorExpressao(this.atual(), delimitadores)) return false;

        if (this.verificar('NUMERO') || this.verificar('STRING') || this.verificar('IDENTIFICADOR')) {
            const ehIdentificador = this.verificar('IDENTIFICADOR');
            this.atualizarPonteiro();

            if (ehIdentificador && this.combinar('ABRE_PARENTESIS')) {
                this.argumentosChamada();
                this.consumir('FECHA_PARENTESIS', null, delimitadores);
            }

            return true;
        }

        if (this.verificar('PALAVRA_RESERVADA', 'true') || this.verificar('PALAVRA_RESERVADA', 'false')) {
            this.atualizarPonteiro();
            return true;
        }

        if (this.combinar('ABRE_PARENTESIS')) {
            this.expressao(['FECHA_PARENTESIS']);
            this.consumir('FECHA_PARENTESIS', null, delimitadores);
            return true;
        }

        this.erroAtual('operando');
        this.atualizarPonteiro();
        return false;
    }

    analisar() {
        this.consumir('PALAVRA_RESERVADA', 'program', ['IDENTIFICADOR', 'PONTO_E_VIRGULA', 'var', 'TIPO_DADO', 'procedure', 'begin']);
        const nomePrograma = this.atual();
        if (this.consumir('IDENTIFICADOR', null, ['PONTO_E_VIRGULA', 'var', 'TIPO_DADO', 'procedure', 'begin'])) {
            this.tabelaSintatica.programa = {
                nome: nomePrograma.valor,
                linha: nomePrograma.linha
            };
            this.arvoreSintatica.nome = nomePrograma.valor;
        }
        this.consumir('PONTO_E_VIRGULA', null, ['var', 'TIPO_DADO', 'procedure', 'begin']);

        this.corpo();

        this.consumir('PONTO_FINAL', null, ['EOF']);

        while (!this.fim()) {
            this.erroAtual('fim do programa');
            this.atualizarPonteiro();
        }

        return {
            sucesso: this.erros.length === 0,
            erros: this.erros,
            errosSintaticos: this.errosSintaticos,
            tabelaSintatica: this.tabelaSintatica,
            tabelaTipos: this.tabelaSintatica.tabelaTipos,
            tabelaSimbolos: this.tabelaSintatica.simbolos,
            arvoreSintatica: this.arvoreSintatica
        };
    }
}

