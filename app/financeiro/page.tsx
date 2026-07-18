"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
};

type Lancamento = {
  id: string;
  tipo: "Receita" | "Despesa";
  descricao: string;
  categoria: string;
  centro_custo: string;
  valor: number;
  vencimento: string;
  status: "Recebido" | "A receber" | "Pago" | "A pagar";
  data_pagamento: string | null;
  observacao: string | null;
  veiculo_id: string | null;
};

type Periodo = "mensal" | "semestral" | "anual";

const categorias = {
  Receita: ["Frete", "Serviço", "Reembolso", "Outras receitas"],
  Despesa: [
    "Combustível",
    "Manutenção",
    "Pedágio",
    "Seguro",
    "Financiamento",
    "Impostos",
    "Salários",
    "Outras despesas",
  ],
};

const nomesMeses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const formularioInicial = {
  tipo: "Despesa" as "Receita" | "Despesa",
  descricao: "",
  categoria: "Combustível",
  centro_custo: "Frota",
  valor: "",
  vencimento: "",
  status: "A pagar" as Lancamento["status"],
  data_pagamento: "",
  observacao: "",
  veiculo_id: "",
};

export default function FinanceiroPage() {
  const hoje = new Date();
  const dataHoje = hoje.toISOString().slice(0, 10);

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const [anoSelecionado, setAnoSelecionado] = useState(
    hoje.getFullYear()
  );
  const [mesSelecionado, setMesSelecionado] = useState(
    hoje.getMonth() + 1
  );
  const [semestreSelecionado, setSemestreSelecionado] = useState(1);
  const [veiculoFiltro, setVeiculoFiltro] = useState("");

  async function carregarDados() {
    const [resultadoFinanceiro, resultadoVeiculos] = await Promise.all([
      supabase
        .from("financeiro")
        .select("*")
        .order("vencimento", { ascending: false }),

      supabase
        .from("veiculos")
        .select("id, placa, marca, modelo")
        .order("placa", { ascending: true }),
    ]);

    if (resultadoFinanceiro.error) {
      setMensagem(
        `Erro ao carregar financeiro: ${resultadoFinanceiro.error.message}`
      );
    } else {
      setLancamentos(resultadoFinanceiro.data ?? []);
    }

    if (resultadoVeiculos.error) {
      setMensagem(
        `Erro ao carregar veículos: ${resultadoVeiculos.error.message}`
      );
    } else {
      setVeiculos(resultadoVeiculos.data ?? []);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function estaRealizado(status: Lancamento["status"]) {
    return status === "Pago" || status === "Recebido";
  }

  function mudarTipo(tipo: "Receita" | "Despesa") {
    setFormulario({
      ...formulario,
      tipo,
      categoria: categorias[tipo][0],
      status: tipo === "Receita" ? "A receber" : "A pagar",
      data_pagamento: "",
    });
  }

  function mudarStatus(status: Lancamento["status"]) {
    setFormulario({
      ...formulario,
      status,
      data_pagamento: estaRealizado(status)
        ? formulario.data_pagamento || dataHoje
        : "",
    });
  }

  function novoLancamento() {
    setFormulario(formularioInicial);
    setEditandoId(null);
    setMensagem("");
    setMostrarFormulario(true);
  }

  function editarLancamento(lancamento: Lancamento) {
    setFormulario({
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      centro_custo: lancamento.centro_custo,
      valor: String(lancamento.valor),
      vencimento: lancamento.vencimento,
      status: lancamento.status,
      data_pagamento: lancamento.data_pagamento ?? "",
      observacao: lancamento.observacao ?? "",
      veiculo_id: lancamento.veiculo_id ?? "",
    });

    setEditandoId(lancamento.id);
    setMostrarFormulario(true);
    setMensagem("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function salvarLancamento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setCarregando(true);
    setMensagem("");

    const realizado = estaRealizado(formulario.status);

    if (realizado && !formulario.data_pagamento) {
      setMensagem(
        formulario.tipo === "Receita"
          ? "Informe a data em que o valor foi recebido."
          : "Informe a data em que o valor foi pago."
      );
      setCarregando(false);
      return;
    }

    const dados = {
      tipo: formulario.tipo,
      descricao: formulario.descricao.trim(),
      categoria: formulario.categoria,
      centro_custo: formulario.centro_custo,
      valor: Number(formulario.valor),
      vencimento: formulario.vencimento,
      status: formulario.status,
      data_pagamento: realizado
        ? formulario.data_pagamento
        : null,
      observacao: formulario.observacao.trim() || null,
      veiculo_id: formulario.veiculo_id || null,
    };

    const estavaEditando = Boolean(editandoId);

    const resultado = editandoId
      ? await supabase
          .from("financeiro")
          .update(dados)
          .eq("id", editandoId)
      : await supabase.from("financeiro").insert(dados);

    if (resultado.error) {
      setMensagem(`Erro ao salvar: ${resultado.error.message}`);
      setCarregando(false);
      return;
    }

    setFormulario(formularioInicial);
    setEditandoId(null);
    setMostrarFormulario(false);

    setMensagem(
      estavaEditando
        ? "Lançamento atualizado com sucesso."
        : "Lançamento cadastrado com sucesso."
    );

    await carregarDados();
    setCarregando(false);
  }

  async function alterarSituacao(lancamento: Lancamento) {
    const novoStatus =
      lancamento.tipo === "Receita" ? "Recebido" : "Pago";

    const { error } = await supabase
      .from("financeiro")
      .update({
        status: novoStatus,
        data_pagamento: dataHoje,
      })
      .eq("id", lancamento.id);

    if (error) {
      setMensagem(`Erro ao atualizar: ${error.message}`);
      return;
    }

    setMensagem(
      lancamento.tipo === "Receita"
        ? "Conta marcada como recebida na data de hoje."
        : "Conta marcada como paga na data de hoje."
    );

    await carregarDados();
  }

  async function excluirLancamento(lancamento: Lancamento) {
    const confirmar = window.confirm(
      `Deseja excluir o lançamento "${lancamento.descricao}"?`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("financeiro")
      .delete()
      .eq("id", lancamento.id);

    if (error) {
      setMensagem(`Erro ao excluir: ${error.message}`);
      return;
    }

    setMensagem("Lançamento excluído com sucesso.");
    await carregarDados();
  }

  function encontrarVeiculo(veiculoId: string | null) {
    if (!veiculoId) return null;

    return (
      veiculos.find((veiculo) => veiculo.id === veiculoId) ?? null
    );
  }

  function pertenceAoPeriodo(dataTexto: string | null) {
    if (!dataTexto) return false;

    const data = new Date(`${dataTexto}T12:00:00`);
    const ano = data.getFullYear();
    const mes = data.getMonth() + 1;

    if (ano !== anoSelecionado) return false;

    if (periodo === "mensal") {
      return mes === mesSelecionado;
    }

    if (periodo === "semestral") {
      return semestreSelecionado === 1 ? mes <= 6 : mes >= 7;
    }

    return true;
  }

  function obterDataReferencia(item: Lancamento) {
    return estaRealizado(item.status)
      ? item.data_pagamento
      : item.vencimento;
  }

  const descricaoPeriodo =
    periodo === "mensal"
      ? `${nomesMeses[mesSelecionado - 1]} de ${anoSelecionado}`
      : periodo === "semestral"
        ? `${semestreSelecionado}º semestre de ${anoSelecionado}`
        : `ano de ${anoSelecionado}`;

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((item) => {
      const correspondeAoVeiculo =
        !veiculoFiltro || item.veiculo_id === veiculoFiltro;

      return (
        correspondeAoVeiculo &&
        pertenceAoPeriodo(obterDataReferencia(item))
      );
    });
  }, [
    lancamentos,
    veiculoFiltro,
    periodo,
    anoSelecionado,
    mesSelecionado,
    semestreSelecionado,
  ]);

  const recebidoPeriodo = somarPorStatus(
    lancamentosFiltrados,
    "Recebido"
  );

  const pagoPeriodo = somarPorStatus(
    lancamentosFiltrados,
    "Pago"
  );

  const aReceberPeriodo = somarPorStatus(
    lancamentosFiltrados,
    "A receber"
  );

  const aPagarPeriodo = somarPorStatus(
    lancamentosFiltrados,
    "A pagar"
  );

  const resultadoPeriodo = recebidoPeriodo - pagoPeriodo;

  const saldoProjetado =
    resultadoPeriodo + aReceberPeriodo - aPagarPeriodo;

  const resumoMensal = nomesMeses.map((mes, indice) => {
    const numeroMes = indice + 1;

    const lancamentosMes = lancamentos.filter((item) => {
      const correspondeAoVeiculo =
        !veiculoFiltro || item.veiculo_id === veiculoFiltro;

      const dataReferencia = obterDataReferencia(item);

      if (!dataReferencia) return false;

      const data = new Date(`${dataReferencia}T12:00:00`);

      return (
        correspondeAoVeiculo &&
        data.getFullYear() === anoSelecionado &&
        data.getMonth() + 1 === numeroMes
      );
    });

    const recebido = somarPorStatus(
      lancamentosMes,
      "Recebido"
    );

    const pago = somarPorStatus(lancamentosMes, "Pago");

    return {
      mes,
      recebido,
      pago,
      resultado: recebido - pago,
    };
  });

  const maiorValorGrafico = Math.max(
    1,
    ...resumoMensal.flatMap((item) => [
      item.recebido,
      item.pago,
    ])
  );

  const comparacaoVeiculos = veiculos
    .map((veiculo) => {
      const lancamentosVeiculo = lancamentos.filter((item) => {
        if (item.veiculo_id !== veiculo.id) return false;

        return pertenceAoPeriodo(obterDataReferencia(item));
      });

      const recebido = somarPorStatus(
        lancamentosVeiculo,
        "Recebido"
      );

      const pago = somarPorStatus(
        lancamentosVeiculo,
        "Pago"
      );

      const aReceber = somarPorStatus(
        lancamentosVeiculo,
        "A receber"
      );

      const aPagar = somarPorStatus(
        lancamentosVeiculo,
        "A pagar"
      );

      const resultado = recebido - pago;
      const projetado = resultado + aReceber - aPagar;

      return {
        ...veiculo,
        recebido,
        pago,
        resultado,
        aReceber,
        aPagar,
        projetado,
        quantidade: lancamentosVeiculo.length,
      };
    })
    .sort((a, b) => b.resultado - a.resultado);

  const maiorResultadoVeiculos = Math.max(
    1,
    ...comparacaoVeiculos.map((item) =>
      Math.abs(item.resultado)
    )
  );

  const anosDisponiveis = Array.from(
    new Set([
      hoje.getFullYear(),
      ...lancamentos.flatMap((item) => {
        const datas = [
          item.vencimento,
          item.data_pagamento,
        ].filter(Boolean) as string[];

        return datas.map((data) =>
          new Date(`${data}T12:00:00`).getFullYear()
        );
      }),
    ])
  ).sort((a, b) => b - a);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Financeiro</h1>

            <p className="mt-1 text-slate-500">
              Controle financeiro, histórico e desempenho da frota.
            </p>
          </div>

          <button
            onClick={novoLancamento}
            className="rounded-xl bg-amber-400 px-5 py-3 font-semibold"
          >
            + Novo lançamento
          </button>
        </div>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Acompanhamento financeiro
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <select
              value={periodo}
              onChange={(e) =>
                setPeriodo(e.target.value as Periodo)
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="mensal">Mensal</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>

            <select
              value={anoSelecionado}
              onChange={(e) =>
                setAnoSelecionado(Number(e.target.value))
              }
              className="rounded-xl border px-4 py-3"
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>

            {periodo === "mensal" && (
              <select
                value={mesSelecionado}
                onChange={(e) =>
                  setMesSelecionado(Number(e.target.value))
                }
                className="rounded-xl border px-4 py-3"
              >
                {nomesMeses.map((mes, indice) => (
                  <option key={mes} value={indice + 1}>
                    {mes}
                  </option>
                ))}
              </select>
            )}

            {periodo === "semestral" && (
              <select
                value={semestreSelecionado}
                onChange={(e) =>
                  setSemestreSelecionado(
                    Number(e.target.value)
                  )
                }
                className="rounded-xl border px-4 py-3"
              >
                <option value={1}>1º semestre</option>
                <option value={2}>2º semestre</option>
              </select>
            )}

            <select
              value={veiculoFiltro}
              onChange={(e) =>
                setVeiculoFiltro(e.target.value)
              }
              className="rounded-xl border px-4 py-3"
            >
              <option value="">Todos os veículos</option>

              {veiculos.map((veiculo) => (
                <option
                  key={veiculo.id}
                  value={veiculo.id}
                >
                  {veiculo.placa} — {veiculo.marca}{" "}
                  {veiculo.modelo}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Card titulo="Recebido" valor={recebidoPeriodo} />
            <Card titulo="Pago" valor={pagoPeriodo} />
            <Card titulo="Resultado" valor={resultadoPeriodo} />
            <Card titulo="A receber" valor={aReceberPeriodo} />
            <Card titulo="A pagar" valor={aPagarPeriodo} />
            <Card
              titulo="Saldo projetado"
              valor={saldoProjetado}
            />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Evolução mensal
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Receitas e despesas realizadas durante{" "}
                {anoSelecionado}.
              </p>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="font-semibold text-green-700">
                ■ Recebido
              </span>

              <span className="font-semibold text-red-700">
                ■ Pago
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="flex min-w-[900px] items-end gap-3">
              {resumoMensal.map((item) => {
                const alturaRecebido =
                  (item.recebido / maiorValorGrafico) * 220;

                const alturaPago =
                  (item.pago / maiorValorGrafico) * 220;

                return (
                  <div
                    key={item.mes}
                    className="flex flex-1 flex-col items-center"
                  >
                    <div className="mb-2 text-center text-xs">
                      <p className="font-semibold text-green-700">
                        {formatarMoeda(item.recebido)}
                      </p>

                      <p className="font-semibold text-red-700">
                        {formatarMoeda(item.pago)}
                      </p>
                    </div>

                    <div className="flex h-56 items-end gap-1">
                      <div
                        className="w-5 rounded-t bg-green-600"
                        style={{
                          height: `${alturaRecebido}px`,
                          minHeight:
                            item.recebido > 0
                              ? "4px"
                              : "0px",
                        }}
                      />

                      <div
                        className="w-5 rounded-t bg-red-600"
                        style={{
                          height: `${alturaPago}px`,
                          minHeight:
                            item.pago > 0
                              ? "4px"
                              : "0px",
                        }}
                      />
                    </div>

                    <p className="mt-3 text-xs font-semibold">
                      {item.mes.slice(0, 3)}
                    </p>

                    <p
                      className={`mt-1 text-xs font-bold ${
                        item.resultado < 0
                          ? "text-red-600"
                          : "text-slate-700"
                      }`}
                    >
                      {formatarMoeda(item.resultado)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Comparação entre veículos
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Ranking de faturamento, gastos e resultado em{" "}
            {descricaoPeriodo}.
          </p>

          <div className="mt-6 space-y-4">
            {comparacaoVeiculos.map((veiculo, indice) => {
              const larguraResultado =
                (Math.abs(veiculo.resultado) /
                  maiorResultadoVeiculos) *
                100;

              return (
                <div
                  key={veiculo.id}
                  className="rounded-2xl border bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 font-bold">
                        {indice + 1}º
                      </div>

                      <div>
                        <p className="text-lg font-bold">
                          {veiculo.placa}
                        </p>

                        <p className="text-sm text-slate-500">
                          {veiculo.marca} {veiculo.modelo}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {veiculo.quantidade} lançamento(s) no período
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-6">
                      <ValorComparacao
                        titulo="Recebido"
                        valor={veiculo.recebido}
                        classe="text-green-700"
                      />

                      <ValorComparacao
                        titulo="Pago"
                        valor={veiculo.pago}
                        classe="text-red-700"
                      />

                      <ValorComparacao
                        titulo="Resultado"
                        valor={veiculo.resultado}
                        classe={
                          veiculo.resultado < 0
                            ? "text-red-700"
                            : "text-slate-900"
                        }
                      />

                      <ValorComparacao
                        titulo="A receber"
                        valor={veiculo.aReceber}
                        classe="text-blue-700"
                      />

                      <ValorComparacao
                        titulo="A pagar"
                        valor={veiculo.aPagar}
                        classe="text-orange-700"
                      />

                      <ValorComparacao
                        titulo="Projetado"
                        valor={veiculo.projetado}
                        classe={
                          veiculo.projetado < 0
                            ? "text-red-700"
                            : "text-slate-900"
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={
                        veiculo.resultado < 0
                          ? "h-full rounded-full bg-red-600"
                          : "h-full rounded-full bg-green-600"
                      }
                      style={{
                        width: `${larguraResultado}%`,
                        minWidth:
                          veiculo.resultado !== 0
                            ? "4px"
                            : "0px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {mensagem && (
          <div className="mt-6 rounded-xl border bg-white px-4 py-3">
            {mensagem}
          </div>
        )}

        {mostrarFormulario && (
          <form
            onSubmit={salvarLancamento}
            className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">
                {editandoId
                  ? "Editar lançamento"
                  : "Novo lançamento"}
              </h2>

              <button
                type="button"
                onClick={() =>
                  setMostrarFormulario(false)
                }
                className="text-slate-500"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <select
                value={formulario.tipo}
                onChange={(e) =>
                  mudarTipo(
                    e.target.value as
                      | "Receita"
                      | "Despesa"
                  )
                }
                className="rounded-xl border px-4 py-3"
              >
                <option>Receita</option>
                <option>Despesa</option>
              </select>

              <input
                required
                value={formulario.descricao}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    descricao: e.target.value,
                  })
                }
                placeholder="Descrição"
                className="rounded-xl border px-4 py-3"
              />

              <select
                value={formulario.categoria}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    categoria: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3"
              >
                {categorias[formulario.tipo].map(
                  (categoria) => (
                    <option key={categoria}>
                      {categoria}
                    </option>
                  )
                )}
              </select>

              <select
                value={formulario.centro_custo}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    centro_custo: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3"
              >
                <option>Frota</option>
                <option>Viagens</option>
                <option>Manutenção</option>
                <option>Administrativo</option>
                <option>Geral</option>
              </select>

              <select
                value={formulario.veiculo_id}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    veiculo_id: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3"
              >
                <option value="">
                  Sem veículo vinculado
                </option>

                {veiculos.map((veiculo) => (
                  <option
                    key={veiculo.id}
                    value={veiculo.id}
                  >
                    {veiculo.placa} — {veiculo.marca}{" "}
                    {veiculo.modelo}
                  </option>
                ))}
              </select>

              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={formulario.valor}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    valor: e.target.value,
                  })
                }
                placeholder="Valor"
                className="rounded-xl border px-4 py-3"
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Data de vencimento
                </label>

                <input
                  required
                  type="date"
                  value={formulario.vencimento}
                  onChange={(e) =>
                    setFormulario({
                      ...formulario,
                      vencimento: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <select
                value={formulario.status}
                onChange={(e) =>
                  mudarStatus(
                    e.target.value as Lancamento["status"]
                  )
                }
                className="rounded-xl border px-4 py-3"
              >
                {formulario.tipo === "Receita" ? (
                  <>
                    <option>A receber</option>
                    <option>Recebido</option>
                  </>
                ) : (
                  <>
                    <option>A pagar</option>
                    <option>Pago</option>
                  </>
                )}
              </select>

              {estaRealizado(formulario.status) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">
                    {formulario.tipo === "Receita"
                      ? "Data do recebimento"
                      : "Data do pagamento"}
                  </label>

                  <input
                    required
                    type="date"
                    value={formulario.data_pagamento}
                    onChange={(e) =>
                      setFormulario({
                        ...formulario,
                        data_pagamento: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </div>
              )}

              <input
                value={formulario.observacao}
                onChange={(e) =>
                  setFormulario({
                    ...formulario,
                    observacao: e.target.value,
                  })
                }
                placeholder="Observação"
                className="rounded-xl border px-4 py-3"
              />
            </div>

            <button
              disabled={carregando}
              className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {carregando
                ? "Salvando..."
                : "Salvar lançamento"}
            </button>
          </form>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold">
              Lançamentos do período
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {lancamentosFiltrados.length} lançamento(s) encontrado(s).
            </p>
          </div>

          {lancamentosFiltrados.length === 0 ? (
            <p className="p-6 text-slate-500">
              Nenhum lançamento encontrado nesse período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Descrição</th>
                    <th className="px-4 py-4">Veículo</th>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Vencimento</th>
                    <th className="px-4 py-4">Data efetiva</th>
                    <th className="px-4 py-4">Valor</th>
                    <th className="px-4 py-4">Situação</th>
                    <th className="px-4 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {lancamentosFiltrados.map((item) => {
                    const veiculo = encontrarVeiculo(
                      item.veiculo_id
                    );

                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-4 py-4 font-medium">
                          {item.descricao}
                        </td>

                        <td className="px-4 py-4">
                          {veiculo
                            ? veiculo.placa
                            : "Geral"}
                        </td>

                        <td className="px-4 py-4">
                          {item.tipo}
                        </td>

                        <td className="px-4 py-4">
                          {formatarData(item.vencimento)}
                        </td>

                        <td className="px-4 py-4">
                          {item.data_pagamento
                            ? formatarData(
                                item.data_pagamento
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {formatarMoeda(item.valor)}
                        </td>

                        <td className="px-4 py-4">
                          {item.status}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {(item.status === "A pagar" ||
                              item.status ===
                                "A receber") && (
                              <button
                                onClick={() =>
                                  alterarSituacao(item)
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                              >
                                {item.tipo === "Receita"
                                  ? "Marcar recebido"
                                  : "Marcar pago"}
                              </button>
                            )}

                            <button
                              onClick={() =>
                                editarLancamento(item)
                              }
                              className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold"
                            >
                              Editar
                            </button>

                            <button
                              onClick={() =>
                                excluirLancamento(item)
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function somarPorStatus(
  lancamentos: Lancamento[],
  status: Lancamento["status"]
) {
  return lancamentos
    .filter((item) => item.status === status)
    .reduce(
      (total, item) => total + Number(item.valor),
      0
    );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{titulo}</p>

      <p
        className={`mt-2 text-xl font-bold ${
          valor < 0
            ? "text-red-600"
            : "text-slate-900"
        }`}
      >
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}

function ValorComparacao({
  titulo,
  valor,
  classe,
}: {
  titulo: string;
  valor: number;
  classe: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{titulo}</p>

      <p className={`mt-1 font-bold ${classe}`}>
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(data: string) {
  return new Date(
    `${data}T12:00:00`
  ).toLocaleDateString("pt-BR");
}