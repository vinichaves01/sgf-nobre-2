"use client";

import Link from "next/link";
import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type StatusViagem =
  | "Em viagem"
  | "Finalizada"
  | "Cancelada";

type TipoViagem =
  | "Carregado"
  | "Vazio"
  | "Deslocamento interno";

type PeriodoFiltro =
  | "mes_atual"
  | "mes_anterior"
  | "ultimos_6_meses"
  | "ano_atual"
  | "ano_anterior"
  | "personalizado"
  | "todo_periodo";

type Viagem = {
  id: string;
  motorista_id: string;
  veiculo_id: string;
  tipo_viagem: TipoViagem;
  motivo_deslocamento: string | null;
  local_carregamento: string;
  destino: string;
  cliente: string | null;
  status: StatusViagem;
  km_inicial: number | null;
  km_final: number | null;
  iniciado_em: string;
  finalizado_em: string | null;
};

type Motorista = {
  id: string;
  nome: string;
};

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
};

type ResumoMensal = {
  chave: string;
  mes: string;
  carregado: number;
  vazio: number;
  interno: number;
  total: number;
  quantidade: number;
  produtivo: number;
};

export default function IndicadoresViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [motoristas, setMotoristas] =
    useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");

  const [periodo, setPeriodo] =
    useState<PeriodoFiltro>("mes_atual");

  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  const [motoristaSelecionado, setMotoristaSelecionado] =
    useState("");

  const [veiculoSelecionado, setVeiculoSelecionado] =
    useState("");

  const [tipoSelecionado, setTipoSelecionado] =
    useState("");

  async function carregarDados() {
    setCarregando(true);
    setMensagem("");

    const [
      resultadoViagens,
      resultadoMotoristas,
      resultadoVeiculos,
    ] = await Promise.all([
      supabase
        .from("viagens")
        .select("*")
        .order("iniciado_em", { ascending: false }),

      supabase
        .from("motoristas")
        .select("id, nome")
        .order("nome", { ascending: true }),

      supabase
        .from("veiculos")
        .select("id, placa, marca, modelo")
        .order("placa", { ascending: true }),
    ]);

    if (resultadoViagens.error) {
      setMensagem(
        `Erro ao carregar viagens: ${resultadoViagens.error.message}`
      );
      setViagens([]);
    } else {
      setViagens(resultadoViagens.data ?? []);
    }

    if (resultadoMotoristas.error) {
      setMensagem(
        `Erro ao carregar motoristas: ${resultadoMotoristas.error.message}`
      );
      setMotoristas([]);
    } else {
      setMotoristas(resultadoMotoristas.data ?? []);
    }

    if (resultadoVeiculos.error) {
      setMensagem(
        `Erro ao carregar caminhões: ${resultadoVeiculos.error.message}`
      );
      setVeiculos([]);
    } else {
      setVeiculos(resultadoVeiculos.data ?? []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const intervaloSelecionado = useMemo(() => {
    return obterIntervalo(
      periodo,
      dataInicial,
      dataFinal
    );
  }, [periodo, dataInicial, dataFinal]);

  const viagensFiltradas = useMemo(() => {
    return viagens.filter((viagem) => {
      const dataViagem = new Date(viagem.iniciado_em);

      const dentroDoPeriodo =
        (!intervaloSelecionado.inicio ||
          dataViagem >= intervaloSelecionado.inicio) &&
        (!intervaloSelecionado.final ||
          dataViagem <= intervaloSelecionado.final);

      const correspondeMotorista =
        !motoristaSelecionado ||
        viagem.motorista_id === motoristaSelecionado;

      const correspondeVeiculo =
        !veiculoSelecionado ||
        viagem.veiculo_id === veiculoSelecionado;

      const correspondeTipo =
        !tipoSelecionado ||
        viagem.tipo_viagem === tipoSelecionado;

      return (
        dentroDoPeriodo &&
        correspondeMotorista &&
        correspondeVeiculo &&
        correspondeTipo
      );
    });
  }, [
    viagens,
    intervaloSelecionado,
    motoristaSelecionado,
    veiculoSelecionado,
    tipoSelecionado,
  ]);

  const finalizadas = viagensFiltradas.filter(
    (viagem) => viagem.status === "Finalizada"
  );

  const emAndamento = viagensFiltradas.filter(
    (viagem) => viagem.status === "Em viagem"
  );

  const canceladas = viagensFiltradas.filter(
    (viagem) => viagem.status === "Cancelada"
  );

  const carregadas = finalizadas.filter(
    (viagem) => viagem.tipo_viagem === "Carregado"
  );

  const vazias = finalizadas.filter(
    (viagem) => viagem.tipo_viagem === "Vazio"
  );

  const internas = finalizadas.filter(
    (viagem) =>
      viagem.tipo_viagem === "Deslocamento interno"
  );

  const kmCarregado =
    calcularQuilometragemTotal(carregadas);

  const kmVazio = calcularQuilometragemTotal(vazias);

  const kmInterno =
    calcularQuilometragemTotal(internas);

  const kmTotal =
    kmCarregado + kmVazio + kmInterno;

  const kmSemCarga = kmVazio + kmInterno;

  const percentualProdutivo =
    kmTotal > 0 ? (kmCarregado / kmTotal) * 100 : 0;

  const percentualVazio =
    kmTotal > 0 ? (kmVazio / kmTotal) * 100 : 0;

  const percentualInterno =
    kmTotal > 0 ? (kmInterno / kmTotal) * 100 : 0;

  const mediaKmPorOperacao =
    finalizadas.length > 0
      ? kmTotal / finalizadas.length
      : 0;

  const duracaoTotalHoras = finalizadas.reduce(
    (total, viagem) =>
      total + calcularDuracaoHoras(viagem),
    0
  );

  const mediaDuracaoHoras =
    finalizadas.length > 0
      ? duracaoTotalHoras / finalizadas.length
      : 0;

  const resumoMensal = useMemo(
    () => criarResumoMensal(finalizadas),
    [finalizadas]
  );

  const resumoCaminhoes = useMemo(() => {
    return veiculos
      .map((veiculo) => {
        const registros = finalizadas.filter(
          (viagem) =>
            viagem.veiculo_id === veiculo.id
        );

        const carregado =
          calcularQuilometragemTotal(
            registros.filter(
              (viagem) =>
                viagem.tipo_viagem === "Carregado"
            )
          );

        const vazio = calcularQuilometragemTotal(
          registros.filter(
            (viagem) =>
              viagem.tipo_viagem === "Vazio"
          )
        );

        const interno =
          calcularQuilometragemTotal(
            registros.filter(
              (viagem) =>
                viagem.tipo_viagem ===
                "Deslocamento interno"
            )
          );

        return {
          id: veiculo.id,
          placa: veiculo.placa,
          descricao: `${veiculo.marca} ${veiculo.modelo}`,
          quantidade: registros.length,
          carregado,
          vazio,
          interno,
          total: carregado + vazio + interno,
        };
      })
      .filter((item) => item.quantidade > 0)
      .sort((a, b) => b.total - a.total);
  }, [veiculos, finalizadas]);

  const resumoMotoristas = useMemo(() => {
    return motoristas
      .map((motorista) => {
        const registros = finalizadas.filter(
          (viagem) =>
            viagem.motorista_id === motorista.id
        );

        const carregado =
          calcularQuilometragemTotal(
            registros.filter(
              (viagem) =>
                viagem.tipo_viagem === "Carregado"
            )
          );

        const vazio = calcularQuilometragemTotal(
          registros.filter(
            (viagem) =>
              viagem.tipo_viagem === "Vazio"
          )
        );

        const interno =
          calcularQuilometragemTotal(
            registros.filter(
              (viagem) =>
                viagem.tipo_viagem ===
                "Deslocamento interno"
            )
          );

        return {
          id: motorista.id,
          nome: motorista.nome,
          quantidade: registros.length,
          carregado,
          vazio,
          interno,
          total: carregado + vazio + interno,
        };
      })
      .filter((item) => item.quantidade > 0)
      .sort((a, b) => b.total - a.total);
  }, [motoristas, finalizadas]);

  const melhorCaminhao = resumoCaminhoes[0] ?? null;
  const melhorMotorista = resumoMotoristas[0] ?? null;

  function limparFiltros() {
    setPeriodo("mes_atual");
    setDataInicial("");
    setDataFinal("");
    setMotoristaSelecionado("");
    setVeiculoSelecionado("");
    setTipoSelecionado("");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Indicadores de viagens
            </h1>

            <p className="mt-1 text-slate-500">
              Análise por período, caminhão, motorista e
              tipo de operação.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/viagens"
              className="rounded-xl border bg-white px-5 py-3 font-semibold"
            >
              Voltar para viagens
            </Link>

            <Link
              href="/"
              className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {mensagem && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {mensagem}
          </div>
        )}

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Filtros dos indicadores
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Todos os números abaixo obedecem aos filtros
                selecionados.
              </p>
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-xl border px-4 py-2 font-semibold"
            >
              Limpar filtros
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Campo titulo="Período">
              <select
                value={periodo}
                onChange={(evento) =>
                  setPeriodo(
                    evento.target.value as PeriodoFiltro
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="mes_atual">
                  Mês atual
                </option>

                <option value="mes_anterior">
                  Mês anterior
                </option>

                <option value="ultimos_6_meses">
                  Últimos 6 meses
                </option>

                <option value="ano_atual">
                  Ano atual
                </option>

                <option value="ano_anterior">
                  Ano anterior
                </option>

                <option value="todo_periodo">
                  Todo o período
                </option>

                <option value="personalizado">
                  Período personalizado
                </option>
              </select>
            </Campo>

            <Campo titulo="Caminhão">
              <select
                value={veiculoSelecionado}
                onChange={(evento) =>
                  setVeiculoSelecionado(
                    evento.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os caminhões
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
            </Campo>

            <Campo titulo="Motorista">
              <select
                value={motoristaSelecionado}
                onChange={(evento) =>
                  setMotoristaSelecionado(
                    evento.target.value
                  )
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os motoristas
                </option>

                {motoristas.map((motorista) => (
                  <option
                    key={motorista.id}
                    value={motorista.id}
                  >
                    {motorista.nome}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo titulo="Tipo de operação">
              <select
                value={tipoSelecionado}
                onChange={(evento) =>
                  setTipoSelecionado(evento.target.value)
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">
                  Todos os tipos
                </option>

                <option value="Carregado">
                  Carregado
                </option>

                <option value="Vazio">
                  Vazio — indo carregar
                </option>

                <option value="Deslocamento interno">
                  Deslocamento interno
                </option>
              </select>
            </Campo>

            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Período analisado
              </p>

              <p className="mt-2 font-semibold">
                {descricaoIntervalo(
                  periodo,
                  intervaloSelecionado.inicio,
                  intervaloSelecionado.final
                )}
              </p>
            </div>
          </div>

          {periodo === "personalizado" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Campo titulo="Data inicial">
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(evento) =>
                    setDataInicial(evento.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Data final">
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(evento) =>
                    setDataFinal(evento.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>
            </div>
          )}
        </section>

        {carregando ? (
          <div className="mt-6 rounded-2xl border bg-white p-8 text-slate-500">
            Carregando indicadores...
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardIndicador
                titulo="KM total"
                valor={formatarNumero(kmTotal)}
                sufixo=" km"
                descricao="Todos os deslocamentos finalizados"
              />

              <CardIndicador
                titulo="KM carregado"
                valor={formatarNumero(kmCarregado)}
                sufixo=" km"
                descricao="Quilometragem produtiva"
              />

              <CardIndicador
                titulo="KM vazio"
                valor={formatarNumero(kmVazio)}
                sufixo=" km"
                descricao="Deslocamento para nova carga"
              />

              <CardIndicador
                titulo="KM interno"
                valor={formatarNumero(kmInterno)}
                sufixo=" km"
                descricao="Manutenção, casa, base e outros"
              />

              <CardIndicador
                titulo="Operações finalizadas"
                valor={formatarNumero(finalizadas.length)}
                descricao="Registros concluídos"
              />

              <CardIndicador
                titulo="Em andamento"
                valor={formatarNumero(emAndamento.length)}
                descricao="Operações ainda abertas"
              />

              <CardIndicador
                titulo="Canceladas"
                valor={formatarNumero(canceladas.length)}
                descricao="Operações canceladas"
              />

              <CardIndicador
                titulo="Média por operação"
                valor={formatarNumero(mediaKmPorOperacao)}
                sufixo=" km"
                descricao="Quilometragem média finalizada"
              />
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardPercentual
                titulo="Percentual produtivo"
                valor={percentualProdutivo}
                descricao="KM rodado carregado"
              />

              <CardPercentual
                titulo="Percentual vazio"
                valor={percentualVazio}
                descricao="KM rodado indo carregar"
              />

              <CardPercentual
                titulo="Percentual interno"
                valor={percentualInterno}
                descricao="KM fora da operação de carga"
              />

              <CardIndicador
                titulo="Média de duração"
                valor={formatarHoras(mediaDuracaoHoras)}
                descricao="Tempo médio por operação"
              />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">
                  Destaque de caminhão
                </h2>

                {melhorCaminhao ? (
                  <div className="mt-5">
                    <p className="text-3xl font-bold">
                      {melhorCaminhao.placa}
                    </p>

                    <p className="mt-1 text-slate-500">
                      {melhorCaminhao.descricao}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <MiniIndicador
                        titulo="KM total"
                        valor={`${formatarNumero(
                          melhorCaminhao.total
                        )} km`}
                      />

                      <MiniIndicador
                        titulo="Operações"
                        valor={String(
                          melhorCaminhao.quantidade
                        )}
                      />

                      <MiniIndicador
                        titulo="KM carregado"
                        valor={`${formatarNumero(
                          melhorCaminhao.carregado
                        )} km`}
                      />

                      <MiniIndicador
                        titulo="KM sem carga"
                        valor={`${formatarNumero(
                          melhorCaminhao.vazio +
                            melhorCaminhao.interno
                        )} km`}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-slate-500">
                    Nenhum caminhão possui operação
                    finalizada no período.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">
                  Destaque de motorista
                </h2>

                {melhorMotorista ? (
                  <div className="mt-5">
                    <p className="text-3xl font-bold">
                      {melhorMotorista.nome}
                    </p>

                    <p className="mt-1 text-slate-500">
                      Maior quilometragem registrada no
                      período
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <MiniIndicador
                        titulo="KM total"
                        valor={`${formatarNumero(
                          melhorMotorista.total
                        )} km`}
                      />

                      <MiniIndicador
                        titulo="Operações"
                        valor={String(
                          melhorMotorista.quantidade
                        )}
                      />

                      <MiniIndicador
                        titulo="KM carregado"
                        valor={`${formatarNumero(
                          melhorMotorista.carregado
                        )} km`}
                      />

                      <MiniIndicador
                        titulo="KM sem carga"
                        valor={`${formatarNumero(
                          melhorMotorista.vazio +
                            melhorMotorista.interno
                        )} km`}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-slate-500">
                    Nenhum motorista possui operação
                    finalizada no período.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-6">
                <h2 className="text-xl font-bold">
                  Comparativo mês a mês
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quilometragem e produtividade mensal
                  conforme os filtros.
                </p>
              </div>

              {resumoMensal.length === 0 ? (
                <p className="p-6 text-slate-500">
                  Nenhuma operação finalizada encontrada.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-sm text-slate-500">
                      <tr>
                        <th className="px-4 py-4">
                          Mês
                        </th>
                        <th className="px-4 py-4">
                          Operações
                        </th>
                        <th className="px-4 py-4">
                          KM carregado
                        </th>
                        <th className="px-4 py-4">
                          KM vazio
                        </th>
                        <th className="px-4 py-4">
                          KM interno
                        </th>
                        <th className="px-4 py-4">
                          KM total
                        </th>
                        <th className="px-4 py-4">
                          % produtivo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {resumoMensal.map((item) => (
                        <tr
                          key={item.chave}
                          className="border-t"
                        >
                          <td className="px-4 py-4 font-semibold capitalize">
                            {item.mes}
                          </td>

                          <td className="px-4 py-4">
                            {item.quantidade}
                          </td>

                          <td className="px-4 py-4">
                            {formatarNumero(
                              item.carregado
                            )}{" "}
                            km
                          </td>

                          <td className="px-4 py-4">
                            {formatarNumero(item.vazio)} km
                          </td>

                          <td className="px-4 py-4">
                            {formatarNumero(
                              item.interno
                            )}{" "}
                            km
                          </td>

                          <td className="px-4 py-4 font-bold">
                            {formatarNumero(item.total)} km
                          </td>

                          <td className="px-4 py-4">
                            {item.produtivo.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-6">
                <h2 className="text-xl font-bold">
                  Indicadores por caminhão
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Comparação individual da frota.
                </p>
              </div>

              {resumoCaminhoes.length === 0 ? (
                <p className="p-6 text-slate-500">
                  Nenhum caminhão possui dados finalizados
                  no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-sm text-slate-500">
                      <tr>
                        <th className="px-4 py-4">
                          Caminhão
                        </th>
                        <th className="px-4 py-4">
                          Operações
                        </th>
                        <th className="px-4 py-4">
                          KM carregado
                        </th>
                        <th className="px-4 py-4">
                          KM vazio
                        </th>
                        <th className="px-4 py-4">
                          KM interno
                        </th>
                        <th className="px-4 py-4">
                          KM total
                        </th>
                        <th className="px-4 py-4">
                          % produtivo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {resumoCaminhoes.map((item) => {
                        const produtivo =
                          item.total > 0
                            ? (item.carregado /
                                item.total) *
                              100
                            : 0;

                        return (
                          <tr
                            key={item.id}
                            className="border-t"
                          >
                            <td className="px-4 py-4">
                              <p className="font-bold">
                                {item.placa}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {item.descricao}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              {item.quantidade}
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(
                                item.carregado
                              )}{" "}
                              km
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(item.vazio)}{" "}
                              km
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(
                                item.interno
                              )}{" "}
                              km
                            </td>

                            <td className="px-4 py-4 font-bold">
                              {formatarNumero(item.total)} km
                            </td>

                            <td className="px-4 py-4">
                              {produtivo.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b p-6">
                <h2 className="text-xl font-bold">
                  Indicadores por motorista
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quilometragem e operações individuais.
                </p>
              </div>

              {resumoMotoristas.length === 0 ? (
                <p className="p-6 text-slate-500">
                  Nenhum motorista possui dados finalizados
                  no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-sm text-slate-500">
                      <tr>
                        <th className="px-4 py-4">
                          Motorista
                        </th>
                        <th className="px-4 py-4">
                          Operações
                        </th>
                        <th className="px-4 py-4">
                          KM carregado
                        </th>
                        <th className="px-4 py-4">
                          KM vazio
                        </th>
                        <th className="px-4 py-4">
                          KM interno
                        </th>
                        <th className="px-4 py-4">
                          KM total
                        </th>
                        <th className="px-4 py-4">
                          % produtivo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {resumoMotoristas.map((item) => {
                        const produtivo =
                          item.total > 0
                            ? (item.carregado /
                                item.total) *
                              100
                            : 0;

                        return (
                          <tr
                            key={item.id}
                            className="border-t"
                          >
                            <td className="px-4 py-4 font-semibold">
                              {item.nome}
                            </td>

                            <td className="px-4 py-4">
                              {item.quantidade}
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(
                                item.carregado
                              )}{" "}
                              km
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(item.vazio)}{" "}
                              km
                            </td>

                            <td className="px-4 py-4">
                              {formatarNumero(
                                item.interno
                              )}{" "}
                              km
                            </td>

                            <td className="px-4 py-4 font-bold">
                              {formatarNumero(item.total)} km
                            </td>

                            <td className="px-4 py-4">
                              {produtivo.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function obterIntervalo(
  periodo: PeriodoFiltro,
  dataInicial: string,
  dataFinal: string
) {
  const agora = new Date();

  if (periodo === "todo_periodo") {
    return {
      inicio: null as Date | null,
      final: null as Date | null,
    };
  }

  if (periodo === "mes_atual") {
    return {
      inicio: new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1,
        0,
        0,
        0
      ),
      final: new Date(
        agora.getFullYear(),
        agora.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (periodo === "mes_anterior") {
    return {
      inicio: new Date(
        agora.getFullYear(),
        agora.getMonth() - 1,
        1,
        0,
        0,
        0
      ),
      final: new Date(
        agora.getFullYear(),
        agora.getMonth(),
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (periodo === "ultimos_6_meses") {
    return {
      inicio: new Date(
        agora.getFullYear(),
        agora.getMonth() - 5,
        1,
        0,
        0,
        0
      ),
      final: new Date(
        agora.getFullYear(),
        agora.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (periodo === "ano_atual") {
    return {
      inicio: new Date(
        agora.getFullYear(),
        0,
        1,
        0,
        0,
        0
      ),
      final: new Date(
        agora.getFullYear(),
        11,
        31,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (periodo === "ano_anterior") {
    return {
      inicio: new Date(
        agora.getFullYear() - 1,
        0,
        1,
        0,
        0,
        0
      ),
      final: new Date(
        agora.getFullYear() - 1,
        11,
        31,
        23,
        59,
        59,
        999
      ),
    };
  }

  return {
    inicio: dataInicial
      ? new Date(`${dataInicial}T00:00:00`)
      : null,

    final: dataFinal
      ? new Date(`${dataFinal}T23:59:59.999`)
      : null,
  };
}

function descricaoIntervalo(
  periodo: PeriodoFiltro,
  inicio: Date | null,
  final: Date | null
) {
  if (periodo === "todo_periodo") {
    return "Todo o histórico";
  }

  if (!inicio && !final) {
    return "Selecione as datas";
  }

  const inicioTexto = inicio
    ? inicio.toLocaleDateString("pt-BR")
    : "Início";

  const finalTexto = final
    ? final.toLocaleDateString("pt-BR")
    : "Hoje";

  return `${inicioTexto} até ${finalTexto}`;
}

function calcularQuilometragemTotal(
  viagens: Viagem[]
) {
  return viagens.reduce((total, viagem) => {
    if (
      viagem.km_inicial === null ||
      viagem.km_final === null
    ) {
      return total;
    }

    const distancia =
      Number(viagem.km_final) -
      Number(viagem.km_inicial);

    return total + Math.max(0, distancia);
  }, 0);
}

function calcularDuracaoHoras(viagem: Viagem) {
  if (!viagem.finalizado_em) {
    return 0;
  }

  const inicio = new Date(
    viagem.iniciado_em
  ).getTime();

  const final = new Date(
    viagem.finalizado_em
  ).getTime();

  return Math.max(0, final - inicio) / 3600000;
}

function criarResumoMensal(
  viagens: Viagem[]
): ResumoMensal[] {
  const agrupado = new Map<string, ResumoMensal>();

  viagens.forEach((viagem) => {
    const data = new Date(viagem.iniciado_em);

    const chave = `${data.getFullYear()}-${String(
      data.getMonth() + 1
    ).padStart(2, "0")}`;

    const mes = data.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    const distancia =
      viagem.km_inicial !== null &&
      viagem.km_final !== null
        ? Math.max(
            0,
            Number(viagem.km_final) -
              Number(viagem.km_inicial)
          )
        : 0;

    const atual =
      agrupado.get(chave) ?? {
        chave,
        mes,
        carregado: 0,
        vazio: 0,
        interno: 0,
        total: 0,
        quantidade: 0,
        produtivo: 0,
      };

    atual.quantidade += 1;
    atual.total += distancia;

    if (viagem.tipo_viagem === "Carregado") {
      atual.carregado += distancia;
    }

    if (viagem.tipo_viagem === "Vazio") {
      atual.vazio += distancia;
    }

    if (
      viagem.tipo_viagem ===
      "Deslocamento interno"
    ) {
      atual.interno += distancia;
    }

    atual.produtivo =
      atual.total > 0
        ? (atual.carregado / atual.total) * 100
        : 0;

    agrupado.set(chave, atual);
  });

  return Array.from(agrupado.values()).sort(
    (a, b) => b.chave.localeCompare(a.chave)
  );
}

function formatarNumero(valor: number) {
  return Number(valor.toFixed(1)).toLocaleString(
    "pt-BR"
  );
}

function formatarHoras(valor: number) {
  if (valor <= 0) {
    return "0h";
  }

  const horas = Math.floor(valor);
  const minutos = Math.round(
    (valor - horas) * 60
  );

  return `${horas}h ${minutos}min`;
}

function Campo({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-600">
        {titulo}
      </span>

      {children}
    </label>
  );
}

function CardIndicador({
  titulo,
  valor,
  sufixo = "",
  descricao,
}: {
  titulo: string;
  valor: string;
  sufixo?: string;
  descricao: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {valor}
        {sufixo}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {descricao}
      </p>
    </div>
  );
}

function CardPercentual({
  titulo,
  valor,
  descricao,
}: {
  titulo: string;
  valor: number;
  descricao: string;
}) {
  const limitado = Math.min(
    100,
    Math.max(0, valor)
  );

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {valor.toFixed(1)}%
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{
            width: `${limitado}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {descricao}
      </p>
    </div>
  );
}

function MiniIndicador({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-slate-500">
        {titulo}
      </p>

      <p className="mt-1 font-bold">{valor}</p>
    </div>
  );
}