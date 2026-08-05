import { semantico } from "../semantico/semantico.js";
import { Parser } from "../sintatico/sintatico.js";
import { classificaTokens } from "./classificaTokens.js";

export class Lexico {
    constructor(codigo = '') {
        this.codigo = String(codigo);
        this.operadores = [
            '!', '(', ')', ';', ',', '.', '+', '-', '/', '=',
            '<', '>', '*', ':', '|', '&'
        ];
        this.validos = [
            '==', '>=', '<=', '<>', '!=', '++', '--', ':=', '||', '&&'
        ];
        this.tokens = [];
        this.errosLexicos = [];
        this.linha = 1;
    }

    adicionarToken(valor, linha = this.linha) {
        const token = classificaTokens(valor, linha);
        this.tokens.push(token);

        if (token.tipo === 'ERRO_LEXICO') {
            this.adicionarErro(
                'TOKEN_INVALIDO',
                linha,
                valor,
                `Token inválido "${valor}".`
            );
        }

        return token;
    }

    adicionarErro(codigo, linha, valor, descricao) {
        this.errosLexicos.push({
            codigo,
            linha,
            valor,
            mensagem: `Erro léxico na linha ${linha}: ${descricao}`
        });
    }

    lerComentarioBloco(indice) {
        const linhaInicial = this.linha;
        let cursor = indice + 1;

        while (cursor < this.codigo.length && this.codigo[cursor] !== '}') {
            if (this.codigo[cursor] === '\n') this.linha++;
            cursor++;
        }

        if (cursor >= this.codigo.length) {
            this.adicionarErro(
                'COMENTARIO_NAO_FECHADO',
                linhaInicial,
                '{',
                'Comentário de bloco não foi fechado com "}".'
            );
            return this.codigo.length;
        }

        return cursor + 1;
    }

    lerComentarioLinha(indice) {
        let cursor = indice + 2;
        while (cursor < this.codigo.length && this.codigo[cursor] !== '\n') {
            cursor++;
        }
        return cursor;
    }

    lerString(indice) {
        const delimitador = this.codigo[indice];
        const linhaInicial = this.linha;
        let cursor = indice + 1;
        let escapado = false;

        while (cursor < this.codigo.length) {
            const caractere = this.codigo[cursor];

            if (caractere === '\n') this.linha++;

            if (!escapado && caractere === delimitador) {
                this.adicionarToken(
                    this.codigo.slice(indice, cursor + 1),
                    linhaInicial
                );
                return cursor + 1;
            }

            if (!escapado && caractere === '\\') {
                escapado = true;
            } else {
                escapado = false;
            }

            cursor++;
        }

        const valor = this.codigo.slice(indice);
        this.tokens.push({
            tipo: 'ERRO_LEXICO',
            valor,
            linha: linhaInicial
        });
        this.adicionarErro(
            'STRING_NAO_FECHADA',
            linhaInicial,
            valor,
            `String iniciada com ${delimitador} não foi fechada.`
        );
        return this.codigo.length;
    }

    lerNumero(indice) {
        let cursor = indice;

        while (/[0-9]/.test(this.codigo[cursor] ?? '')) cursor++;

        if (
            this.codigo[cursor] === '.' &&
            /[0-9]/.test(this.codigo[cursor + 1] ?? '')
        ) {
            cursor++;
            while (/[0-9]/.test(this.codigo[cursor] ?? '')) cursor++;
        }

        // Preserva sequências como "12abc" em um único token inválido.
        while (/[a-zA-Z0-9_]/.test(this.codigo[cursor] ?? '')) cursor++;

        this.adicionarToken(this.codigo.slice(indice, cursor));
        return cursor;
    }

    lerIdentificador(indice) {
        let cursor = indice + 1;
        while (/[a-zA-Z0-9_]/.test(this.codigo[cursor] ?? '')) cursor++;
        this.adicionarToken(this.codigo.slice(indice, cursor));
        return cursor;
    }

    lerOperador(indice) {
        const operadorDuplo = this.codigo.slice(indice, indice + 2);

        if (this.validos.includes(operadorDuplo)) {
            this.adicionarToken(operadorDuplo);
            return indice + 2;
        }

        if (operadorDuplo === '=:') {
            this.tokens.push({
                tipo: 'ERRO_LEXICO',
                valor: operadorDuplo,
                linha: this.linha
            });
            this.adicionarErro(
                'OPERADOR_INVALIDO',
                this.linha,
                operadorDuplo,
                `Operador inválido "${operadorDuplo}". Use ":=" para atribuição.`
            );
            return indice + 2;
        }

        this.adicionarToken(this.codigo[indice]);
        return indice + 1;
    }

    tokenizar() {
        this.tokens = [];
        this.errosLexicos = [];
        this.linha = 1;

        let indice = 0;
        while (indice < this.codigo.length) {
            const caractere = this.codigo[indice];

            if (caractere === '\n') {
                this.linha++;
                indice++;
                continue;
            }

            if (/\s/.test(caractere)) {
                indice++;
                continue;
            }

            if (caractere === '{') {
                indice = this.lerComentarioBloco(indice);
                continue;
            }

            if (caractere === '/' && this.codigo[indice + 1] === '/') {
                indice = this.lerComentarioLinha(indice);
                continue;
            }

            if (caractere === '"' || caractere === "'") {
                indice = this.lerString(indice);
                continue;
            }

            if (/[0-9]/.test(caractere)) {
                indice = this.lerNumero(indice);
                continue;
            }

            if (/[a-zA-Z_]/.test(caractere)) {
                indice = this.lerIdentificador(indice);
                continue;
            }

            if (this.operadores.includes(caractere)) {
                indice = this.lerOperador(indice);
                continue;
            }

            this.adicionarToken(caractere);
            indice++;
        }

        return this.tokens;
    }

    iniciar() {
        this.tokenizar();

        const tokensValidos = this.tokens.filter(
            (token) => token.tipo !== 'ERRO_LEXICO'
        );
        const resultadoSintatico = new Parser(tokensValidos).analisar();
        const resultadoSemantico = semantico(resultadoSintatico);
        const errosSintaticos = resultadoSintatico.errosSintaticos ?? [];
        const errosSemanticos = resultadoSemantico.errosSemanticos ?? [];
        const sucesso = this.errosLexicos.length === 0 &&
            errosSintaticos.length === 0 &&
            errosSemanticos.length === 0;

        return {
            sucesso,
            tokens: [...this.tokens],
            errosLexicos: [...this.errosLexicos],
            errosSintaticos,
            errosSemanticos,
            resultadoSintatico,
            resultadoSemantico,
            tabelaTipos: resultadoSintatico.tabelaTipos,
            tabelaSimbolos: resultadoSemantico.tabelaSimbolos,
            arvoreSintatica: resultadoSintatico.arvoreSintatica
        };
    }

    analiseSintatica() {
        return this.iniciar();
    }
}
