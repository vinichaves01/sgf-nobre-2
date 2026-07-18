"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number | null;
  status: string;
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

export default function RelatoriosPage() {
  const hoje = new Date();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");

  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const [anoSelecionado, setAnoSelecionado] = useState(
    hoje.getFullYear()
  );
  const [mesSelecionado, setMesSelecionado] = useState(
    hoje.getMonth() + 1
  );
  const [semestreSelecionado, setSemestreSelecionado] = useState(
    hoje.getMonth() + 1 <= 6 ? 1 : 2
  );
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      setMensagem("");

      const [resultadoVeiculos, resultadoFinanceiro] =
        await Promise.all([
          supabase
            .from("veiculos")
            .select("id, placa, marca, modelo, ano, status")
            .order("placa", { ascending: true }),

          supabase
            .from("financeiro")
            .select("*")
            .order("vencimento", { ascending: false }),
        ]);

      if (resultadoVeiculos.error) {
        setMensagem(
          `Erro ao carregar veículos: ${resultadoVeiculos.error.message}`
        );
      } else {
        setVeiculos(resultadoVeiculos.data ?? []);
      }

      if (resultadoFinanceiro.error) {
        setMensagem(
          `Erro ao carregar financeiro: ${resultadoFinanceiro.error.message}`
        );
      } else {
        setLancamentos(resultadoFinanceiro.data ?? []);
      }

      setCarregando(false);
    }

    carregarDados();
  }, []);

  function estaRealizado(status: Lancamento["status"]) {
    return status === "Pago" || status === "Recebido";
  }

  function obterDataReferencia(item: Lancamento) {
    return estaRealizado(item.status)
      ? item.data_pagamento
      : item.vencimento;
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
      return semestreSelecionado === 1
        ? mes >= 1 && mes <= 6
        : mes >= 7 && mes <= 12;
    }

    return true;
  }

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((item) => {
      const correspondeAoVeiculo =
        !veiculoSelecionado ||
        item.veiculo_id === veiculoSelecionado;

      const dataReferencia = estaRealizado(item.status)
        ? item.data_pagamento
        : item.vencimento;

      if (!dataReferencia) return false;

      const data = new Date(`${dataReferencia}T12:00:00`);
      const ano = data.getFullYear();
      const mes = data.getMonth() + 1;

      let correspondeAoPeriodo = ano === anoSelecionado;

      if (periodo === "mensal") {
        correspondeAoPeriodo =
          correspondeAoPeriodo && mes === mesSelecionado;
      }

      if (periodo === "semestral") {
        correspondeAoPeriodo =
          correspondeAoPeriodo &&
          (semestreSelecionado === 1
            ? mes >= 1 && mes <= 6
            : mes >= 7 && mes <= 12);
      }

      return correspondeAoVeiculo && correspondeAoPeriodo;
    });
  }, [
    lancamentos,
    veiculoSelecionado,
    periodo,
    anoSelecionado,
    mesSelecionado,
    semestreSelecionado,
  ]);

  const recebido = somarPorStatus(
    lancamentosFiltrados,
    "Recebido"
  );

  const pago = somarPorStatus(lancamentosFiltrados, "Pago");

  const aReceber = somarPorStatus(
    lancamentosFiltrados,
    "A receber"
  );

  const aPagar = somarPorStatus(
    lancamentosFiltrados,
    "A pagar"
  );

  const resultado = recebido - pago;

  const saldoProjetado =
    resultado + aReceber - aPagar;

  const margem =
    recebido > 0 ? (resultado / recebido) * 100 : 0;

  const receitasRealizadas = lancamentosFiltrados.filter(
    (item) => item.status === "Recebido"
  );

  const despesasRealizadas = lancamentosFiltrados.filter(
    (item) => item.status === "Pago"
  );

  const despesasPorCategoria = useMemo(() => {
    const agrupadas = new Map<string, number>();

    despesasRealizadas.forEach((item) => {
      const categoria = item.categoria || "Sem categoria";
      const totalAtual = agrupadas.get(categoria) ?? 0;

      agrupadas.set(
        categoria,
        totalAtual + Number(item.valor)
      );
    });

    return Array.from(agrupadas.entries())
      .map(([categoria, valor]) => ({
        categoria,
        valor,
        percentual: pago > 0 ? (valor / pago) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [despesasRealizadas, pago]);

  const resumoMensal = useMemo(() => {
    return nomesMeses.map((mes, indice) => {
      const numeroMes = indice + 1;

      const lancamentosMes = lancamentos.filter((item) => {
        const correspondeAoVeiculo =
          !veiculoSelecionado ||
          item.veiculo_id === veiculoSelecionado;

        const dataReferencia = estaRealizado(item.status)
          ? item.data_pagamento
          : item.vencimento;

        if (!dataReferencia) return false;

        const data = new Date(
          `${dataReferencia}T12:00:00`
        );

        return (
          correspondeAoVeiculo &&
          data.getFullYear() === anoSelecionado &&
          data.getMonth() + 1 === numeroMes
        );
      });

      const recebidoMes = somarPorStatus(
        lancamentosMes,
        "Recebido"
      );

      const pagoMes = somarPorStatus(
        lancamentosMes,
        "Pago"
      );

      return {
        mes,
        recebido: recebidoMes,
        pago: pagoMes,
        resultado: recebidoMes - pagoMes,
      };
    });
  }, [
    lancamentos,
    veiculoSelecionado,
    anoSelecionado,
  ]);

  const maiorValorGrafico = Math.max(
    1,
    ...resumoMensal.flatMap((item) => [
      item.recebido,
      item.pago,
    ])
  );

  const veiculoAtual =
    veiculos.find(
      (veiculo) => veiculo.id === veiculoSelecionado
    ) ?? null;

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

  const descricaoPeriodo =
    periodo === "mensal"
      ? `${nomesMeses[mesSelecionado - 1]} de ${anoSelecionado}`
      : periodo === "semestral"
        ? `${semestreSelecionado}º semestre de ${anoSelecionado}`
        : `ano de ${anoSelecionado}`;

  function imprimirRelatorio() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>

            <p className="mt-1 text-slate-500">
              Histórico financeiro e desempenho por veículo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border bg-white px-5 py-3 font-semibold"
            >
              Voltar ao Dashboard
            </Link>

            <button
              onClick={imprimirRelatorio}
              className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            >
              Imprimir relatório
            </button>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm print:mt-0 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-600">
                Nobre Transportadora
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                Relatório financeiro
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {veiculoAtual
                  ? `${veiculoAtual.placa} — ${veiculoAtual.marca} ${veiculoAtual.modelo}`
                  : "Todos os veículos"}
                {" • "}
                {descricaoPeriodo}
              </p>
            </div>

            {veiculoAtual && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm">
                <p>
                  <strong>Status:</strong>{" "}
                  {veiculoAtual.status}
                </p>

                <p className="mt-1">
                  <strong>Ano:</strong>{" "}
                  {veiculoAtual.ano ?? "Não informado"}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4 print:hidden">
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
              value={veiculoSelecionado}
              onChange={(e) =>
                setVeiculoSelecionado(e.target.value)
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
        </section>

        {mensagem && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Card titulo="Recebido" valor={recebido} />
          <Card titulo="Pago" valor={pago} />
          <Card titulo="Resultado" valor={resultado} />
          <Card titulo="A receber" valor={aReceber} />
          <Card titulo="A pagar" valor={aPagar} />
          <Card
            titulo="Saldo projetado"
            valor={saldoProjetado}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">
              Indicadores do período
            </h3>

            <div className="mt-5 space-y-4">
              <Indicador
                titulo="Margem sobre faturamento"
                valor={`${margem.toFixed(1)}%`}
              />

              <Indicador
                titulo="Receitas realizadas"
                valor={String(receitasRealizadas.length)}
              />

              <Indicador
                titulo="Despesas realizadas"
                valor={String(despesasRealizadas.length)}
              />

              <Indicador
                titulo="Total de lançamentos"
                valor={String(lancamentosFiltrados.length)}
              />

              <Indicador
                titulo="Ticket médio recebido"
                valor={formatarMoeda(
                  receitasRealizadas.length > 0
                    ? recebido /
                        receitasRealizadas.length
                    : 0
                )}
              />

              <Indicador
                titulo="Despesa média"
                valor={formatarMoeda(
                  despesasRealizadas.length > 0
                    ? pago / despesasRealizadas.length
                    : 0
                )}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm xl:col-span-2">
            <h3 className="text-lg font-bold">
              Despesas por categoria
            </h3>

            {despesasPorCategoria.length === 0 ? (
              <p className="mt-5 text-slate-500">
                Nenhuma despesa paga encontrada no período.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {despesasPorCategoria.map((item) => (
                  <div key={item.categoria}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span>{item.categoria}</span>

                      <strong>
                        {formatarMoeda(item.valor)}
                      </strong>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width: `${item.percentual}%`,
                        }}
                      />
                    </div>

                    <p className="mt-1 text-right text-xs text-slate-500">
                      {item.percentual.toFixed(1)}% das despesas
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">
                Evolução mensal
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Movimentação realizada durante{" "}
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

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5">
            <h3 className="text-lg font-bold">
              Histórico detalhado
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {carregando
                ? "Carregando..."
                : `${lancamentosFiltrados.length} lançamento(s) no período.`}
            </p>
          </div>

          {lancamentosFiltrados.length === 0 ? (
            <p className="p-6 text-slate-500">
              Nenhum lançamento encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-4 py-4">
                      Data efetiva
                    </th>
                    <th className="px-4 py-4">
                      Vencimento
                    </th>
                    <th className="px-4 py-4">
                      Descrição
                    </th>
                    <th className="px-4 py-4">
                      Veículo
                    </th>
                    <th className="px-4 py-4">
                      Categoria
                    </th>
                    <th className="px-4 py-4">
                      Situação
                    </th>
                    <th className="px-4 py-4">
                      Valor
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lancamentosFiltrados.map((item) => {
                    const veiculo =
                      veiculos.find(
                        (registro) =>
                          registro.id === item.veiculo_id
                      ) ?? null;

                    return (
                      <tr
                        key={item.id}
                        className="border-t"
                      >
                        <td className="px-4 py-4">
                          {item.data_pagamento
                            ? formatarData(
                                item.data_pagamento
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          {formatarData(item.vencimento)}
                        </td>

                        <td className="px-4 py-4 font-medium">
                          {item.descricao}
                        </td>

                        <td className="px-4 py-4">
                          {veiculo
                            ? veiculo.placa
                            : "Geral"}
                        </td>

                        <td className="px-4 py-4">
                          {item.categoria}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td
                          className={`px-4 py-4 font-bold ${
                            item.tipo === "Receita"
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {item.tipo === "Receita"
                            ? "+"
                            : "-"}{" "}
                          {formatarMoeda(item.valor)}
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

function Indicador({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0">
      <span className="text-sm text-slate-500">
        {titulo}
      </span>

      <strong>{valor}</strong>
    </div>
  );
}

function classeStatus(status: Lancamento["status"]) {
  if (status === "Recebido") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Pago") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "A receber") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-red-100 text-red-700";
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