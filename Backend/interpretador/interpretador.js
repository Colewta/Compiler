function exibirValor(valor) {
    if (valor === 1 || valor === true) return String(valor);
    if (valor === 0 || valor === false) return String(valor);
    if (valor == null) return '';
    return String(valor);
}

export class InterpretadorCodigoIntermediario {
    constructor(programa, entradas = [], opcoes = {}) {
        this.programa = programa ?? {};
        this.instrucoes = this.programa.instrucoes ?? [];
        this.entradas = Array.isArray(entradas) ? [...entradas] : [entradas];
        this.opcoes = { limitePassos: 10000, ...opcoes };
        this.pilha = [];
        this.memoriaFinal = [];
        this.rotulos = new Map();
        this.saida = [];
        this.linhaSaida = [];
        this.i = 0;
        this.passos = 0;
        this.instrucaoAtual = null;
        this.parado = false;
    }

    preparar() {
        this.instrucoes.forEach((instrucao, indice) => {
            if (instrucao.rotulo != null) this.rotulos.set(String(instrucao.rotulo), indice);
        });
    }

    desempilhar() {
        if (this.pilha.length === 0) throw new Error('Pilha de dados vazia.');
        return this.pilha.pop();
    }

    executarBinaria(op) {
        const direito = this.desempilhar();
        const esquerdo = this.desempilhar();
        let resultado;

        switch (op) {
            case 'SOMA': resultado = esquerdo + direito; break;
            case 'SUBT': resultado = esquerdo - direito; break;
            case 'MULT': resultado = esquerdo * direito; break;
            case 'DIVI':
                if (direito === 0) throw new Error('Divisão por zero.');
                resultado = Math.trunc(esquerdo / direito);
                break;
            case 'MODI':
                if (direito === 0) throw new Error('Divisão por zero no resto inteiro.');
                resultado = esquerdo % direito;
                break;
            case 'CONJ': resultado = esquerdo !== 0 && direito !== 0 ? 1 : 0; break;
            case 'DISJ': resultado = esquerdo !== 0 || direito !== 0 ? 1 : 0; break;
            case 'CMME': resultado = esquerdo < direito ? 1 : 0; break;
            case 'CMMA': resultado = esquerdo > direito ? 1 : 0; break;
            case 'CMIG': resultado = esquerdo === direito ? 1 : 0; break;
            case 'CMDG': resultado = esquerdo !== direito ? 1 : 0; break;
            case 'CMAG': resultado = esquerdo >= direito ? 1 : 0; break;
            case 'CMEG': resultado = esquerdo <= direito ? 1 : 0; break;
            default: throw new Error(`Operação MEPA "${op}" desconhecida.`);
        }

        this.pilha.push(resultado);
        this.i++;
    }

    saltar(rotulo) {
        const destino = this.rotulos.get(String(rotulo));
        if (destino == null) throw new Error(`Rótulo "${rotulo}" não encontrado.`);
        this.i = destino;
    }

    proximaEntrada(inteira) {
        if (this.entradas.length === 0) throw new Error('O comando de leitura precisa de uma entrada.');
        const valor = this.entradas.shift();
        if (!inteira) return String(valor ?? '');

        const texto = String(valor ?? '').trim();
        if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(texto)) {
            throw new Error(`Entrada "${texto}" não é numérica.`);
        }
        const numero = Number(texto.replace(',', '.'));
        if (!Number.isFinite(numero)) throw new Error(`Entrada "${texto}" não é numérica.`);
        return numero;
    }

    imprimir(valor) {
        this.linhaSaida.push(exibirValor(valor));
    }

    finalizarLinha() {
        this.saida.push(this.linhaSaida.join(' '));
        this.linhaSaida = [];
    }

    executarInstrucao(instrucao) {
        const binarias = [
            'SOMA', 'SUBT', 'MULT', 'DIVI', 'MODI', 'CONJ', 'DISJ',
            'CMME', 'CMMA', 'CMIG', 'CMDG', 'CMAG', 'CMEG'
        ];
        if (binarias.includes(instrucao.op)) return this.executarBinaria(instrucao.op);

        const quantidade = Number(instrucao.argumento ?? 0);
        switch (instrucao.op) {
            case 'INPP':
                this.pilha = [];
                this.i++;
                break;
            case 'AMEM':
                for (let n = 0; n < quantidade; n++) this.pilha.push(0);
                this.i++;
                break;
            case 'DMEM':
                if (quantidade > this.pilha.length) throw new Error('DMEM tentou liberar mais posições que as disponíveis.');
                this.pilha.splice(this.pilha.length - quantidade, quantidade);
                this.i++;
                break;
            case 'CRCT':
                this.pilha.push(instrucao.argumento);
                this.i++;
                break;
            case 'CRVL': {
                const endereco = Number(instrucao.argumento);
                if (endereco < 0 || endereco >= this.pilha.length) throw new Error(`Endereço relativo ${endereco} inválido.`);
                this.pilha.push(this.pilha[endereco]);
                this.i++;
                break;
            }
            case 'ARMZ': {
                const endereco = Number(instrucao.argumento);
                const valor = this.desempilhar();
                if (endereco < 0 || endereco >= this.pilha.length) throw new Error(`Endereço relativo ${endereco} inválido.`);
                this.pilha[endereco] = valor;
                this.i++;
                break;
            }
            case 'INVR':
                this.pilha.push(-this.desempilhar());
                this.i++;
                break;
            case 'NEGA':
                this.pilha.push(this.desempilhar() === 0 ? 1 : 0);
                this.i++;
                break;
            case 'DSVS':
                this.saltar(instrucao.argumento);
                break;
            case 'DSVF':
                if (this.desempilhar() === 0) this.saltar(instrucao.argumento);
                else this.i++;
                break;
            case 'NADA':
                this.i++;
                break;
            case 'LEIT':
                this.pilha.push(this.proximaEntrada(true));
                this.i++;
                break;
            case 'LECH':
                this.pilha.push(this.proximaEntrada(false));
                this.i++;
                break;
            case 'IMPR':
            case 'IMPC':
                this.imprimir(this.desempilhar());
                this.i++;
                break;
            case 'IMPE':
                this.finalizarLinha();
                this.i++;
                break;
            case 'PARA':
                if (this.linhaSaida.length > 0) this.finalizarLinha();
                this.parado = true;
                this.i = this.instrucoes.length;
                break;
            default:
                throw new Error(`Instrução MEPA "${instrucao.op}" não é suportada.`);
        }
    }

    capturarMemoria() {
        const memoriaGlobal = {};
        for (const [nome, simbolo] of Object.entries(this.programa.enderecos ?? {})) {
            memoriaGlobal[nome] = this.memoriaFinal[simbolo.endereco];
        }
        return memoriaGlobal;
    }

    resultado(sucesso, erro = null) {
        return {
            sucesso,
            arquitetura: 'MEPA',
            saida: this.saida,
            textoSaida: this.saida.join('\n'),
            memoriaGlobal: this.capturarMemoria(),
            pilhaFinal: [...this.pilha],
            topo: this.pilha.length - 1,
            contadorPrograma: this.i,
            instrucoesExecutadas: this.passos,
            entradasRestantes: this.entradas,
            erro
        };
    }

    executar() {
        if (!this.programa?.sucesso || this.programa?.arquitetura !== 'MEPA') {
            return this.resultado(false, {
                codigo: 'PROGRAMA_MEPA_INVALIDO',
                linha: null,
                mensagem: 'O código MEPA não está pronto para execução.'
            });
        }

        try {
            this.preparar();
            while (!this.parado && this.i >= 0 && this.i < this.instrucoes.length) {
                if (this.passos >= this.opcoes.limitePassos) {
                    throw new Error(`Limite de ${this.opcoes.limitePassos} instruções excedido; possível laço infinito.`);
                }
                this.instrucaoAtual = this.instrucoes[this.i];
                this.passos++;

                if (this.instrucaoAtual.op === 'DMEM' && this.memoriaFinal.length === 0) {
                    this.memoriaFinal = [...this.pilha];
                }
                this.executarInstrucao(this.instrucaoAtual);
            }

            if (!this.parado) throw new Error('Programa terminou sem executar a instrução PARA.');
            if (this.memoriaFinal.length === 0) this.memoriaFinal = [...this.pilha];
            return this.resultado(true);
        } catch (erro) {
            if (this.memoriaFinal.length === 0) this.memoriaFinal = [...this.pilha];
            return this.resultado(false, {
                codigo: 'ERRO_EXECUCAO_MEPA',
                linha: this.instrucaoAtual?.linha ?? null,
                instrucao: this.instrucaoAtual?.indice ?? null,
                mensagem: `Erro de execução${this.instrucaoAtual?.linha ? ` na linha ${this.instrucaoAtual.linha}` : ''}: ${erro.message}`
            });
        }
    }
}

export function interpretarCodigo(programa, entradas = [], opcoes = {}) {
    return new InterpretadorCodigoIntermediario(programa, entradas, opcoes).executar();
}

export default interpretarCodigo;
