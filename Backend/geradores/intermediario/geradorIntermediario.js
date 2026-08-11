const OPERACOES_BINARIAS = Object.freeze({
    '+': 'SOMA',
    '-': 'SUBT',
    '*': 'MULT',
    '/': 'DIVI',
    div: 'DIVI',
    and: 'CONJ',
    '&&': 'CONJ',
    or: 'DISJ',
    '||': 'DISJ',
    '<': 'CMME',
    '>': 'CMMA',
    '=': 'CMIG',
    '==': 'CMIG',
    '<>': 'CMDG',
    '!=': 'CMDG',
    '>=': 'CMAG',
    '<=': 'CMEG'
});

function extrairTabela(entrada) {
    return entrada?.resultadoSintatico?.tabelaSintatica ??
        entrada?.tabelaSintatica ??
        entrada;
}

function removerAspas(valor) {
    const texto = String(valor ?? '');
    if (!/^(["']).*\1$/s.test(texto)) return texto;

    const conteudo = texto.slice(1, -1);
    return conteudo
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\([\\"'])/g, '$1');
}

class GeradorExpressaoMEPA {
    constructor(gerador, expressao, escopo) {
        this.gerador = gerador;
        this.tokens = Array.isArray(expressao?.tokens) ? expressao.tokens : [];
        this.escopo = escopo;
        this.ptr = 0;
    }

    atual() {
        return this.tokens[this.ptr] ?? null;
    }

    combinar(...valores) {
        if (!valores.includes(this.atual()?.valor)) return null;
        return this.tokens[this.ptr++];
    }

    gerar() {
        if (this.tokens.length === 0) {
            this.gerador.adicionarErro(null, 'EXPRESSAO_VAZIA', 'Não foi possível gerar uma expressão vazia.');
            return;
        }

        this.expressaoOu();
        if (this.ptr < this.tokens.length) {
            const token = this.atual();
            this.gerador.adicionarErro(
                token?.linha,
                'EXPRESSAO_NAO_GERADA',
                `Token inesperado "${token?.valor}" durante a geração da expressão.`
            );
        }
    }

    expressaoOu() {
        this.expressaoE();
        let operador;
        while ((operador = this.combinar('or', '||'))) {
            this.expressaoE();
            this.gerador.emitir(OPERACOES_BINARIAS[operador.valor], null, operador.linha);
        }
    }

    expressaoE() {
        this.expressaoRelacional();
        let operador;
        while ((operador = this.combinar('and', '&&'))) {
            this.expressaoRelacional();
            this.gerador.emitir(OPERACOES_BINARIAS[operador.valor], null, operador.linha);
        }
    }

    expressaoRelacional() {
        this.expressaoAditiva();
        while (OPERACOES_BINARIAS[this.atual()?.valor]?.startsWith('CM')) {
            const operador = this.tokens[this.ptr++];
            this.expressaoAditiva();
            this.gerador.emitir(OPERACOES_BINARIAS[operador.valor], null, operador.linha);
        }
    }

    expressaoAditiva() {
        this.expressaoMultiplicativa();
        let operador;
        while ((operador = this.combinar('+', '-'))) {
            this.expressaoMultiplicativa();
            this.gerador.emitir(OPERACOES_BINARIAS[operador.valor], null, operador.linha);
        }
    }

    expressaoMultiplicativa() {
        this.expressaoUnaria();
        let operador;
        while ((operador = this.combinar('*', '/', 'div'))) {
            this.expressaoUnaria();
            this.gerador.emitir(OPERACOES_BINARIAS[operador.valor], null, operador.linha);
        }
    }

    expressaoUnaria() {
        const operador = this.combinar('+', '-', 'not', '!');
        if (!operador) return this.expressaoPrimaria();

        this.expressaoUnaria();
        if (operador.valor === '-') this.gerador.emitir('INVR', null, operador.linha);
        if (operador.valor === 'not' || operador.valor === '!') {
            this.gerador.emitir('NEGA', null, operador.linha);
        }
    }

    expressaoPrimaria() {
        const token = this.atual();
        if (!token) return;

        if (token.tipo === 'NUMERO') {
            this.ptr++;
            this.gerador.emitir('CRCT', Number(token.valor), token.linha);
            return;
        }

        if (token.tipo === 'STRING') {
            this.ptr++;
            this.gerador.emitir('CRCT', removerAspas(token.valor), token.linha);
            return;
        }

        if (token.valor === 'true' || token.valor === 'false') {
            this.ptr++;
            this.gerador.emitir('CRCT', token.valor === 'true' ? 1 : 0, token.linha);
            return;
        }

        if (token.tipo === 'IDENTIFICADOR') {
            this.ptr++;
            const simbolo = this.gerador.resolverVariavel(token.valor, this.escopo);
            if (!simbolo) {
                this.gerador.adicionarErro(
                    token.linha,
                    'VARIAVEL_SEM_ENDERECO',
                    `A variável "${token.valor}" não possui endereço relativo na MEPA.`
                );
                return;
            }
            this.gerador.emitir('CRVL', simbolo.endereco, token.linha);
            return;
        }

        if (this.combinar('(')) {
            this.expressaoOu();
            if (!this.combinar(')')) {
                this.gerador.adicionarErro(token.linha, 'PARENTESE_NAO_FECHADO', 'Parêntese não fechado na expressão.');
            }
            return;
        }

        this.ptr++;
        this.gerador.adicionarErro(token.linha, 'OPERANDO_INVALIDO', `Operando inválido "${token.valor}".`);
    }
}

export class GeradorCodigoIntermediario {
    constructor(entrada) {
        this.entrada = entrada ?? {};
        this.tabela = extrairTabela(entrada);
        this.instrucoes = [];
        this.erros = [];
        this.rotuloAtual = 0;
        this.enderecos = {};
    }

    adicionarErro(linha, codigo, descricao) {
        this.erros.push({
            codigo,
            linha: linha ?? null,
            mensagem: linha == null
                ? `Erro de geração: ${descricao}`
                : `Erro de geração na linha ${linha}: ${descricao}`
        });
    }

    emitir(op, argumento = null, linha = null, rotulo = null) {
        const instrucao = {
            indice: this.instrucoes.length,
            rotulo,
            op,
            argumento,
            linha: linha ?? null
        };
        this.instrucoes.push(instrucao);
        return instrucao;
    }

    novoRotulo() {
        return this.rotuloAtual++;
    }

    prepararEnderecos() {
        const globais = (this.tabela?.declaracoes ?? []).filter(
            (declaracao) => declaracao.escopo === 'global' && declaracao.categoria !== 'parametro'
        );

        globais.forEach((declaracao, endereco) => {
            this.enderecos[declaracao.nome] = {
                nome: declaracao.nome,
                endereco,
                tipo: declaracao.tipo,
                escopo: declaracao.escopo,
                linha: declaracao.linha
            };
        });
        return globais;
    }

    resolverVariavel(nome, escopo = 'global') {
        if (escopo !== 'global') return null;
        return this.enderecos[nome] ?? null;
    }

    gerarExpressao(expressao, escopo = 'global') {
        new GeradorExpressaoMEPA(this, expressao, escopo).gerar();
    }

    tipoExpressao(expressao) {
        const tokens = expressao?.tokens ?? [];
        if (tokens.length === 1 && tokens[0].tipo === 'STRING') return 'string';
        if (tokens.length === 1 && tokens[0].tipo === 'IDENTIFICADOR') {
            return this.enderecos[tokens[0].valor]?.tipo;
        }
        return null;
    }

    gerarComando(comando, escopo = 'global') {
        if (!comando) return;
        const escopoComando = comando.escopo ?? escopo;

        switch (comando.tipo) {
            case 'bloco':
                for (const filho of comando.comandos ?? []) this.gerarComando(filho, escopoComando);
                break;

            case 'atribuicao': {
                const destino = this.resolverVariavel(comando.alvo, escopoComando);
                if (!destino) {
                    this.adicionarErro(comando.linha, 'VARIAVEL_SEM_ENDERECO', `A variável "${comando.alvo}" não possui endereço relativo.`);
                    break;
                }
                this.gerarExpressao(comando.expressao, escopoComando);
                this.emitir('ARMZ', destino.endereco, comando.linha);
                break;
            }

            case 'read':
                for (const identificador of comando.identificadores ?? []) {
                    const destino = this.resolverVariavel(identificador.nome, escopoComando);
                    if (!destino) {
                        this.adicionarErro(identificador.linha, 'VARIAVEL_SEM_ENDERECO', `A variável "${identificador.nome}" não possui endereço relativo.`);
                        continue;
                    }
                    const leituraTexto = ['string', 'str'].includes(destino.tipo);
                    this.emitir(leituraTexto ? 'LECH' : 'LEIT', null, identificador.linha ?? comando.linha);
                    this.emitir('ARMZ', destino.endereco, identificador.linha ?? comando.linha);
                }
                break;

            case 'write':
                for (const argumento of comando.argumentos ?? []) {
                    this.gerarExpressao(argumento, escopoComando);
                    const texto = ['string', 'str'].includes(this.tipoExpressao(argumento));
                    this.emitir(texto ? 'IMPC' : 'IMPR', null, argumento?.tokens?.[0]?.linha ?? comando.linha);
                }
                if (comando.quebraLinha) this.emitir('IMPE', null, comando.linha);
                break;

            case 'if': {
                const rotuloSenao = this.novoRotulo();
                const rotuloFim = comando.senao ? this.novoRotulo() : rotuloSenao;
                this.gerarExpressao(comando.condicao, escopoComando);
                this.emitir('DSVF', rotuloSenao, comando.linha);
                this.gerarComando(comando.entao, escopoComando);

                if (comando.senao) {
                    this.emitir('DSVS', rotuloFim, comando.linha);
                    this.emitir('NADA', null, comando.linha, rotuloSenao);
                    this.gerarComando(comando.senao, escopoComando);
                }
                this.emitir('NADA', null, comando.linha, rotuloFim);
                break;
            }

            case 'while': {
                const rotuloInicio = this.novoRotulo();
                const rotuloFim = this.novoRotulo();
                this.emitir('NADA', null, comando.linha, rotuloInicio);
                this.gerarExpressao(comando.condicao, escopoComando);
                this.emitir('DSVF', rotuloFim, comando.linha);
                this.gerarComando(comando.corpo, escopoComando);
                this.emitir('DSVS', rotuloInicio, comando.linha);
                this.emitir('NADA', null, comando.linha, rotuloFim);
                break;
            }

            case 'chamada':
                this.adicionarErro(
                    comando.linha,
                    'PROCEDIMENTOS_NAO_SUPORTADOS_MEPA',
                    'A etapa de geração MEPA apresentada nas aulas considera programas LALG sem procedimentos.'
                );
                break;

            default:
                break;
        }
    }

    formatarInstrucao(instrucao) {
        const indice = String(instrucao.indice).padStart(3, '0');
        const rotulo = instrucao.rotulo == null ? '' : `${instrucao.rotulo}:`;
        const argumento = instrucao.argumento == null
            ? ''
            : ` ${typeof instrucao.argumento === 'string'
                ? JSON.stringify(instrucao.argumento)
                : instrucao.argumento}`;
        return `${indice}  ${rotulo.padEnd(5)} ${instrucao.op}${argumento}`.trimEnd();
    }

    gerar() {
        if (!this.tabela) {
            this.adicionarErro(null, 'TABELA_SINTATICA_AUSENTE', 'Tabela sintática ausente.');
            return this.resultado(false);
        }

        const errosAnteriores = [
            ...(this.entrada?.errosLexicos ?? []),
            ...(this.entrada?.errosSintaticos ?? []),
            ...(this.entrada?.errosSemanticos ?? [])
        ];
        if (errosAnteriores.length > 0) {
            this.adicionarErro(null, 'ETAPA_ANTERIOR_INVALIDA', 'A geração foi bloqueada por erros das etapas anteriores.');
            return this.resultado(false);
        }

        if ((this.tabela.procedimentos ?? []).length > 0) {
            this.adicionarErro(
                this.tabela.procedimentos[0]?.linha,
                'PROCEDIMENTOS_NAO_SUPORTADOS_MEPA',
                'Conforme o recorte de geração das aulas, o programa MEPA deve ser escrito sem procedimentos.'
            );
            return this.resultado(true);
        }

        const globais = this.prepararEnderecos();
        this.emitir('INPP');
        for (const declaracao of globais) this.emitir('AMEM', 1, declaracao.linha);

        for (const declaracao of globais) {
            if (!declaracao.inicializacao) continue;
            this.gerarExpressao(declaracao.inicializacao, 'global');
            this.emitir('ARMZ', this.enderecos[declaracao.nome].endereco, declaracao.linha);
        }

        this.gerarComando(this.tabela.fluxo, 'global');
        for (let indice = globais.length - 1; indice >= 0; indice--) {
            this.emitir('DMEM', 1, globais[indice].linha);
        }
        this.emitir('PARA');
        return this.resultado(true);
    }

    resultado(analisado) {
        return {
            sucesso: analisado && this.erros.length === 0,
            analisado,
            arquitetura: 'MEPA',
            erros: this.erros,
            instrucoes: this.instrucoes,
            codigo: this.instrucoes.map((instrucao) => this.formatarInstrucao(instrucao)).join('\n'),
            enderecos: this.enderecos,
            declaracoes: this.tabela?.declaracoes ?? [],
            procedimentos: {}
        };
    }
}

export function gerarCodigoIntermediario(entrada) {
    return new GeradorCodigoIntermediario(entrada).gerar();
}

export default gerarCodigoIntermediario;
