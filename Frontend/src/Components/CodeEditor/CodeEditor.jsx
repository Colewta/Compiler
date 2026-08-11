import Editor from '@monaco-editor/react';
import { useMemo, useRef, useState } from 'react';
import { Lexico } from '../../../../Backend/analisadores/lexico/lexico.js';
import { interpretarCodigo } from '../../../../Backend/interpretador/interpretador.js';
import { registerLalgLanguage } from '../../../../Backend/monaco/lalgLanguage.js';
import { defineLalgTheme } from '../../../../Backend/monaco/lalgTheme.js';
import styles from './styles.module.css';

const CODIGO_EXEMPLO = `program exemplo_mepa;
var x, y: integer;
begin
    readln(x, y);
    if x > y then
        writeln(x)
    else
        writeln(y)
end.
`;

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'tokens', rotulo: 'Tokens' },
  { id: 'lexico', rotulo: 'Léxico' },
  { id: 'sintatico', rotulo: 'Sintático' },
  { id: 'semantico', rotulo: 'Semântico' },
  { id: 'simbolos', rotulo: 'Símbolos' },
  { id: 'intermediario', rotulo: 'Intermediário' },
  { id: 'execucao', rotulo: 'Execução' },
];

function Icone({ nome, tamanho = 18 }) {
  const caminhos = {
    play: <path d="m8 5 11 7-11 7V5Z" />,
    refresh: <path d="M20 11a8.1 8.1 0 1 0 .2 3M20 4v7h-7" />,
    code: <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <path d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />,
    terminal: <path d="m5 7 4 5-4 5m6 0h8" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={tamanho}
      viewBox="0 0 24 24"
      width={tamanho}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {caminhos[nome]}
    </svg>
  );
}

function Contador({ valor }) {
  if (!valor) return null;
  return <span className={styles.tabCount}>{valor}</span>;
}

function EstadoVazio({ titulo, descricao }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Icone nome="terminal" tamanho={24} /></span>
      <strong>{titulo}</strong>
      <p>{descricao}</p>
    </div>
  );
}

function ListaErros({ erros, tituloVazio, aoSelecionarLinha }) {
  if (!erros?.length) {
    return (
      <EstadoVazio
        titulo={tituloVazio}
        descricao="Nenhum problema foi encontrado nesta etapa."
      />
    );
  }

  return (
    <div className={styles.errorList}>
      {erros.map((erro, indice) => (
        <button
          className={styles.errorItem}
          key={`${erro.codigo ?? 'erro'}-${erro.linha ?? 0}-${indice}`}
          onClick={() => erro.linha && aoSelecionarLinha(erro.linha)}
          type="button"
        >
          <span className={styles.errorIndicator}><Icone nome="alert" /></span>
          <span className={styles.errorText}>
            <span className={styles.errorMeta}>
              {erro.codigo?.replaceAll('_', ' ') ?? 'ERRO'}
              {erro.linha ? ` · linha ${erro.linha}` : ''}
            </span>
            <span>{erro.mensagem ?? String(erro)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function TabelaTokens({ tokens }) {
  if (!tokens?.length) {
    return (
      <EstadoVazio
        titulo="Nenhum token disponível"
        descricao="Compile um código para preencher a tabela léxica."
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Lexema</th>
            <th>Classificação</th>
            <th>Linha</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, indice) => (
            <tr key={`${token.valor}-${token.linha}-${indice}`}>
              <td className={styles.indexCell}>{indice + 1}</td>
              <td><code className={styles.lexeme}>{token.valor}</code></td>
              <td>
                <span className={`${styles.typeBadge} ${token.tipo === 'ERRO_LEXICO' ? styles.typeError : ''}`}>
                  {token.tipo.replaceAll('_', ' ')}
                </span>
              </td>
              <td>{token.linha}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaSimbolos({ simbolos }) {
  const entradas = Object.entries(simbolos ?? {});

  if (!entradas.length) {
    return (
      <EstadoVazio
        titulo="Tabela de símbolos vazia"
        descricao="As declarações válidas aparecerão aqui após a compilação."
      />
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Escopo</th>
            <th>End. relativo</th>
            <th>Utilização</th>
          </tr>
        </thead>
        <tbody>
          {entradas.map(([chave, simbolo]) => (
            <tr key={chave}>
              <td><code className={styles.lexeme}>{simbolo.nome}</code></td>
              <td>{simbolo.tipo}</td>
              <td>{simbolo.categoria}</td>
              <td><span className={styles.scope}>{simbolo.escopo}</span></td>
              <td>{simbolo.enderecoRelativo ?? '—'}</td>
              <td>
                <span className={['procedimento', 'programa'].includes(simbolo.categoria) || simbolo.utilizada ? styles.ready : styles.pending}>
                  {['procedimento', 'programa'].includes(simbolo.categoria)
                    ? 'declarado'
                    : simbolo.utilizada ? 'utilizada' : 'não utilizada'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodigoIntermediario({ geracao }) {
  if (!geracao?.analisado) {
    return (
      <EstadoVazio
        titulo="Código intermediário indisponível"
        descricao="Corrija os erros das etapas anteriores e compile novamente."
      />
    );
  }

  if (!geracao.sucesso) {
    return (
      <ListaErros
        erros={geracao.erros}
        tituloVazio="Nenhuma instrução gerada"
        aoSelecionarLinha={() => {}}
      />
    );
  }

  return (
    <div className={styles.codePanel}>
      <div className={styles.codeToolbar}>
        <div>
          <span>Bytecode da máquina de pilha MEPA</span>
          <strong>{geracao.instrucoes.length} instruções</strong>
        </div>
        <span className={styles.generatedBadge}>gerado</span>
      </div>
      <pre className={styles.intermediateCode}><code>{geracao.codigo}</code></pre>
    </div>
  );
}

function PainelExecucao({ execucao, entrada, aoMudarEntrada, aoExecutar, podeExecutar }) {
  const memoria = Object.entries(execucao?.memoriaGlobal ?? {});

  return (
    <div className={styles.executionPanel}>
      <div className={styles.inputGroup}>
        <div>
          <label htmlFor="runtime-input">Entrada do programa</label>
          <span>Informe um valor por linha para cada variável lida por read/readln.</span>
        </div>
        <textarea
          id="runtime-input"
          onChange={(evento) => aoMudarEntrada(evento.target.value)}
          placeholder={'Exemplo:\n10\ntrue'}
          value={entrada}
        />
        <button
          className={styles.executeInlineButton}
          disabled={!podeExecutar}
          onClick={aoExecutar}
          type="button"
        >
          <Icone nome="play" />
          Executar código
        </button>
      </div>

      <div className={styles.runtimeConsole}>
        <div className={styles.runtimeHeader}>
          <span>Saída do programa</span>
          {execucao && (
            <span className={execucao.sucesso ? styles.runtimeOk : styles.runtimeFail}>
              {execucao.sucesso
                ? `${execucao.instrucoesExecutadas} instruções executadas`
                : 'execução interrompida'}
            </span>
          )}
        </div>
        <pre className={styles.runtimeOutput}>{
          !execucao
            ? 'A saída aparecerá aqui após a execução.'
            : (execucao.erro?.mensagem ?? execucao.textoSaida) || '(programa finalizado sem saída)'
        }</pre>
      </div>

      {memoria.length > 0 && (
        <div className={styles.memorySection}>
          <span>Memória global ao finalizar</span>
          <div className={styles.memoryGrid}>
            {memoria.map(([nome, valor]) => (
              <div key={nome}>
                <code>{nome}</code>
                <strong>{String(valor)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Fase({ nome, descricao, quantidade, disponivel = true }) {
  const aprovada = disponivel && quantidade === 0;
  const classeEstado = !disponivel
    ? styles.phaseBlocked
    : aprovada ? styles.phaseSuccess : styles.phaseError;

  return (
    <div className={`${styles.phaseCard} ${classeEstado}`}>
      <span className={styles.phaseIcon}>
        <Icone nome={aprovada ? 'check' : disponivel ? 'alert' : 'terminal'} />
      </span>
      <div>
        <strong>{nome}</strong>
        <span>
          {!disponivel
            ? 'Não executada por erros anteriores'
            : aprovada ? descricao : `${quantidade} problema(s) encontrado(s)`}
        </span>
      </div>
    </div>
  );
}

function Resumo({ resultado }) {
  if (!resultado) {
    return (
      <EstadoVazio
        titulo="Pronto para analisar"
        descricao="Clique em Compilar para executar as análises e gerar o bytecode MEPA."
      />
    );
  }

  const bloqueado = resultado.errosSintaticos.length > 0;
  const geracaoDisponivel =
    resultado.errosLexicos.length === 0 &&
    resultado.errosSintaticos.length === 0 &&
    resultado.errosSemanticos.length === 0;

  return (
    <div className={styles.summaryContent}>
      <div className={styles.phaseGrid}>
        <Fase
          descricao="Tokens reconhecidos"
          nome="Análise léxica"
          quantidade={resultado.errosLexicos.length}
        />
        <Fase
          descricao="Estrutura válida"
          nome="Análise sintática"
          quantidade={resultado.errosSintaticos.length}
        />
        <Fase
          descricao="Tipos e símbolos válidos"
          disponivel={!bloqueado}
          nome="Análise semântica"
          quantidade={resultado.errosSemanticos.length}
        />
        <Fase
          descricao="Bytecode para a máquina de pilha MEPA gerado"
          disponivel={geracaoDisponivel}
          nome="Geração MEPA"
          quantidade={resultado.errosGeracao?.length ?? 0}
        />
      </div>

      <div className={styles.console}>
        <div className={styles.consoleHeader}>
          <span className={styles.consoleDots}><i /><i /><i /></span>
          saída do compilador
        </div>
        <div className={styles.consoleBody}>
          <span className={styles.prompt}>$</span>
          <span>compilar programa.lalg</span>
          <p className={resultado.sucesso ? styles.consoleSuccess : styles.consoleError}>
            {resultado.sucesso
              ? '✓ Compilação concluída sem erros.'
              : `✕ Compilação encerrada com ${
                resultado.errosLexicos.length +
                resultado.errosSintaticos.length +
                resultado.errosSemanticos.length +
                (resultado.errosGeracao?.length ?? 0)
              } problema(s).`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CodeEditor() {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [code, setCode] = useState(CODIGO_EXEMPLO);
  const [resultado, setResultado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('resumo');
  const [erroInterno, setErroInterno] = useState('');
  const [entradaExecucao, setEntradaExecucao] = useState('10\n4');
  const [execucao, setExecucao] = useState(null);

  const contagens = useMemo(() => ({
    tokens: resultado?.tokens?.length ?? 0,
    lexico: resultado?.errosLexicos?.length ?? 0,
    sintatico: resultado?.errosSintaticos?.length ?? 0,
    semantico: resultado?.errosSemanticos?.length ?? 0,
    simbolos: Object.keys(resultado?.tabelaSimbolos ?? {}).length,
    intermediario: resultado?.instrucoesIntermediarias?.length ?? 0,
    execucao: execucao?.saida?.length ?? 0,
  }), [resultado, execucao]);

  const linhas = code.split('\n').length;
  const totalErros = contagens.lexico + contagens.sintatico + contagens.semantico +
    (resultado?.errosGeracao?.length ?? 0);

  function limparMarcadores() {
    const modelo = editorRef.current?.getModel();
    if (modelo && monacoRef.current) {
      monacoRef.current.editor.setModelMarkers(modelo, 'lalg', []);
    }
  }

  function aplicarMarcadores(analise) {
    const modelo = editorRef.current?.getModel();
    if (!modelo || !monacoRef.current) return;

    const erros = [
      ...analise.errosLexicos,
      ...analise.errosSintaticos,
      ...analise.errosSemanticos,
      ...(analise.errosGeracao ?? []),
    ];
    const marcadores = erros
      .filter((erro) => erro.linha)
      .map((erro) => {
        const linha = Math.min(Math.max(erro.linha, 1), modelo.getLineCount());
        return {
          severity: monacoRef.current.MarkerSeverity.Error,
          message: erro.mensagem ?? 'Erro de compilação',
          startLineNumber: linha,
          startColumn: 1,
          endLineNumber: linha,
          endColumn: modelo.getLineMaxColumn(linha),
        };
      });

    monacoRef.current.editor.setModelMarkers(modelo, 'lalg', marcadores);
  }

  function handleCompile() {
    setErroInterno('');
    setExecucao(null);

    try {
      const analise = new Lexico(code).iniciar();
      setResultado(analise);
      aplicarMarcadores(analise);

      if (analise.errosLexicos.length) setAbaAtiva('lexico');
      else if (analise.errosSintaticos.length) setAbaAtiva('sintatico');
      else if (analise.errosSemanticos.length) setAbaAtiva('semantico');
      else setAbaAtiva('intermediario');
    } catch (erro) {
      setResultado(null);
      setErroInterno(erro instanceof Error ? erro.message : String(erro));
      limparMarcadores();
    }
  }

  function handleExecute() {
    setErroInterno('');

    try {
      const analise = new Lexico(code).iniciar();
      setResultado(analise);
      aplicarMarcadores(analise);

      if (!analise.sucesso) {
        setExecucao(null);
        if (analise.errosLexicos.length) setAbaAtiva('lexico');
        else if (analise.errosSintaticos.length) setAbaAtiva('sintatico');
        else if (analise.errosSemanticos.length) setAbaAtiva('semantico');
        else setAbaAtiva('intermediario');
        return;
      }

      const entradas = entradaExecucao
        .split(/\r?\n/)
        .map((valor) => valor.trim())
        .filter((valor) => valor.length > 0);
      const resultadoExecucao = interpretarCodigo(analise.resultadoGeracao, entradas);
      setExecucao(resultadoExecucao);
      setAbaAtiva('execucao');

      if (resultadoExecucao.erro?.linha) {
        selecionarLinha(resultadoExecucao.erro.linha);
      }
    } catch (erro) {
      setExecucao(null);
      setErroInterno(erro instanceof Error ? erro.message : String(erro));
    }
  }

  function handleReset() {
    setCode(CODIGO_EXEMPLO);
    setResultado(null);
    setExecucao(null);
    setEntradaExecucao('');
    setErroInterno('');
    setAbaAtiva('resumo');
    limparMarcadores();
  }

  function handleBeforeMount(monaco) {
    registerLalgLanguage(monaco);
    defineLalgTheme(monaco);
  }

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme('lalgTheme');
  }

  function selecionarLinha(linha) {
    editorRef.current?.revealLineInCenter(linha);
    editorRef.current?.setPosition({ lineNumber: linha, column: 1 });
    editorRef.current?.focus();
  }

  function conteudoAba() {
    if (erroInterno) {
      return (
        <div className={styles.internalError}>
          <Icone nome="alert" />
          <div>
            <strong>Falha interna durante a compilação</strong>
            <span>{erroInterno}</span>
          </div>
        </div>
      );
    }

    switch (abaAtiva) {
      case 'tokens':
        return <TabelaTokens tokens={resultado?.tokens} />;
      case 'lexico':
        return (
          <ListaErros
            aoSelecionarLinha={selecionarLinha}
            erros={resultado?.errosLexicos}
            tituloVazio="Análise léxica aprovada"
          />
        );
      case 'sintatico':
        return (
          <ListaErros
            aoSelecionarLinha={selecionarLinha}
            erros={resultado?.errosSintaticos}
            tituloVazio="Análise sintática aprovada"
          />
        );
      case 'semantico':
        return (
          <ListaErros
            aoSelecionarLinha={selecionarLinha}
            erros={resultado?.errosSemanticos}
            tituloVazio="Análise semântica aprovada"
          />
        );
      case 'simbolos':
        return <TabelaSimbolos simbolos={resultado?.tabelaSimbolos} />;
      case 'intermediario':
        return <CodigoIntermediario geracao={resultado?.resultadoGeracao} />;
      case 'execucao':
        return (
          <PainelExecucao
            aoExecutar={handleExecute}
            aoMudarEntrada={setEntradaExecucao}
            entrada={entradaExecucao}
            execucao={execucao}
            podeExecutar={Boolean(resultado?.resultadoGeracao?.sucesso)}
          />
        );
      default:
        return <Resumo resultado={resultado} />;
    }
  }

  function contadorDaAba(id) {
    if (id === 'resumo') return totalErros;
    return contagens[id] ?? 0;
  }

  return (
    <main className={styles.page}>
      <header className={styles.appHeader}>
        <div className={styles.brand}>
          <span className={styles.logo}><Icone nome="code" tamanho={22} /></span>
          <div>
            <strong>LALG Studio</strong>
            <span>Ambiente de análise do compilador</span>
          </div>
        </div>
        <span className={styles.version}>Compilador acadêmico · v1.0</span>
      </header>

      <section className={styles.workspace}>
        <article className={styles.editorCard}>
          <div className={styles.cardHeader}>
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>L</span>
              <div>
                <strong>programa.lalg</strong>
                <span>{linhas} linhas · {code.length} caracteres</span>
              </div>
            </div>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} onClick={handleReset} type="button">
                <Icone nome="refresh" />
                Restaurar
              </button>
              <button className={styles.primaryButton} onClick={handleCompile} type="button">
                <Icone nome="play" />
                Compilar
              </button>
              <button className={styles.runButton} onClick={handleExecute} type="button">
                <Icone nome="terminal" />
                Executar
              </button>
            </div>
          </div>

          <div className={styles.editorShell}>
            <Editor
              height="100%"
              beforeMount={handleBeforeMount}
              defaultLanguage="lalg"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              onMount={handleEditorDidMount}
              options={{
                automaticLayout: true,
                bracketPairColorization: { enabled: true },
                fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: false },
                padding: { top: 18, bottom: 18 },
                renderLineHighlight: 'all',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
              }}
            />
          </div>

          <footer className={styles.editorFooter}>
            <span>LALG</span>
            <span>UTF-8</span>
            <span>Espaços: 4</span>
          </footer>
        </article>

        <article className={styles.resultsCard}>
          <div className={styles.resultHeader}>
            <div>
              <span className={styles.eyebrow}>Resultado da análise</span>
              <strong>
                {!resultado
                  ? 'Aguardando compilação'
                  : resultado.sucesso ? 'Programa válido' : 'Revisão necessária'}
              </strong>
            </div>
            <span className={`${styles.statusPill} ${
              !resultado ? styles.statusIdle
                : resultado.sucesso ? styles.statusSuccess : styles.statusError
            }`}>
              <i />
              {!resultado ? 'não executado' : resultado.sucesso ? 'aprovado' : `${totalErros} erro(s)`}
            </span>
          </div>

          <div aria-label="Resultados da compilação" className={styles.tabs} role="tablist">
            {ABAS.map((aba) => (
              <button
                aria-selected={abaAtiva === aba.id}
                className={abaAtiva === aba.id ? styles.activeTab : ''}
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                role="tab"
                type="button"
              >
                {aba.rotulo}
                <Contador valor={contadorDaAba(aba.id)} />
              </button>
            ))}
          </div>

          <div className={styles.tabPanel} role="tabpanel">
            {conteudoAba()}
          </div>
        </article>
      </section>
    </main>
  );
}
