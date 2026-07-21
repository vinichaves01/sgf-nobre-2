"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import MobileNav from "@/components/MobileNav";

type StatusViagem =
  | "Em viagem"
  | "Finalizada"
  | "Cancelada";

type TipoViagem =
  | "Carregado"
  | "Vazio"
  | "Deslocamento interno";

type MotivoDeslocamento =
  | "Manutenção"
  | "Retorno para casa"
  | "Abastecimento"
  | "Pátio/Base"
  | "Lavagem"
  | "Inspeção"
  | "Outro";

type TipoMotorista = "Fixo" | "Folguista";

type Motorista = {
  id: string;
  nome: string;
  tipo_motorista: TipoMotorista;
  veiculo_id: string | null;
  status: string;
};

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  status: string;
};

type Viagem = {
  id: string;
  motorista_id: string;
  veiculo_id: string;
  tipo_viagem: TipoViagem;
  motivo_deslocamento: MotivoDeslocamento | null;
  local_carregamento: string;
  destino: string;
  cliente: string | null;
  status: StatusViagem;
  km_inicial: number | null;
  km_final: number | null;
  iniciado_em: string;
  finalizado_em: string | null;
  observacao_inicio: string | null;
  observacao_final: string | null;
  created_at: string;
};

const motivosDeslocamento: MotivoDeslocamento[] = [
  "Manutenção",
  "Retorno para casa",
  "Abastecimento",
  "Pátio/Base",
  "Lavagem",
  "Inspeção",
  "Outro",
];


export default function ViagensPage() {
  const router = useRouter();

  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);


  const [finalizando, setFinalizando] =
    useState<Viagem | null>(null);

  const [kmFinal, setKmFinal] = useState("");
  const [observacaoFinal, setObservacaoFinal] =
    useState("");

  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState("");
  const [filtroMotorista, setFiltroMotorista] =
    useState("");
  const [filtroVeiculo, setFiltroVeiculo] =
    useState("");

  const [agora, setAgora] = useState(new Date());

  const carregarDados = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCarregando(true);
      }

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
          .select(
            "id, nome, tipo_motorista, veiculo_id, status"
          )
          .order("nome", { ascending: true }),

        supabase
          .from("veiculos")
          .select("id, placa, marca, modelo, status")
          .order("placa", { ascending: true }),
      ]);

      const erros: string[] = [];

      if (resultadoViagens.error) {
        erros.push(
          `Viagens: ${resultadoViagens.error.message}`
        );
      } else {
        setViagens(resultadoViagens.data ?? []);
      }

      if (resultadoMotoristas.error) {
        erros.push(
          `Motoristas: ${resultadoMotoristas.error.message}`
        );
      } else {
        setMotoristas(resultadoMotoristas.data ?? []);
      }

      if (resultadoVeiculos.error) {
        erros.push(
          `Veículos: ${resultadoVeiculos.error.message}`
        );
      } else {
        setVeiculos(resultadoVeiculos.data ?? []);
      }

      if (erros.length > 0) {
        setMensagem(
          `Erro ao atualizar os dados — ${erros.join(" | ")}`
        );
      } else {
        setMensagem("");
      }

      setCarregando(false);
    },
    []
  );

  useEffect(() => {
    let ativo = true;

    const atualizarSilenciosamente = () => {
      if (!ativo) return;

      setAgora(new Date());
      void carregarDados(true);
    };

    const iniciar = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!ativo) return;

      if (error) {
        setMensagem(
          `Não foi possível recuperar sua sessão: ${error.message}`
        );
        setCarregando(false);
        return;
      }

      if (!session) {
        setSessaoPronta(false);
        setCarregando(false);
        router.replace("/login");
        return;
      }

      setSessaoPronta(true);
      await carregarDados(false);
      setAgora(new Date());
    };

    const canal = supabase
      .channel("viagens-tempo-real")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "viagens",
        },
        atualizarSilenciosamente
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "motoristas",
        },
        atualizarSilenciosamente
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "veiculos",
        },
        atualizarSilenciosamente
      )
      .subscribe((status) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setMensagem(
            "A conexão em tempo real foi interrompida. Atualize a página caso os dados parem de sincronizar."
          );
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, session) => {
        if (!ativo) return;

        if (!session) {
          setSessaoPronta(false);
          router.replace("/login");
          return;
        }

        setSessaoPronta(true);
      }
    );

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        atualizarSilenciosamente();
      }
    };

    window.addEventListener("focus", atualizarSilenciosamente);
    document.addEventListener(
      "visibilitychange",
      atualizarAoVoltar
    );

    void iniciar();

    return () => {
      ativo = false;
      subscription.unsubscribe();

      window.removeEventListener(
        "focus",
        atualizarSilenciosamente
      );

      document.removeEventListener(
        "visibilitychange",
        atualizarAoVoltar
      );

      void supabase.removeChannel(canal);
    };
  }, [carregarDados, router]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setAgora(new Date());
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, []);

  function abrirFinalizacao(viagem: Viagem) {
    setFinalizando(viagem);

    setKmFinal("");

    setObservacaoFinal("");
    setMensagem("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function finalizarViagem(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (!finalizando) return;

    setSalvando(true);
    setMensagem("");

    if (!kmFinal.trim()) {
      setMensagem(
        "Informe a quilometragem final para concluir a viagem."
      );
      setSalvando(false);
      return;
    }

    const kmFinalNumero = Number(kmFinal);

    if (
      !Number.isFinite(kmFinalNumero) ||
      kmFinalNumero < 0
    ) {
      setMensagem(
        "Informe uma quilometragem final válida."
      );
      setSalvando(false);
      return;
    }

    const {
      data: viagemAtual,
      error: erroConsulta,
    } = await supabase
      .from("viagens")
      .select("*")
      .eq("id", finalizando.id)
      .single();

    if (erroConsulta || !viagemAtual) {
      setMensagem(
        `Não foi possível atualizar a viagem antes de finalizar: ${
          erroConsulta?.message ?? "registro não encontrado"
        }`
      );
      setSalvando(false);
      return;
    }

    if (viagemAtual.status !== "Em viagem") {
      setMensagem(
        "Esta viagem já foi finalizada ou cancelada em outro aparelho."
      );
      setFinalizando(null);
      await carregarDados(true);
      setSalvando(false);
      return;
    }

    if (viagemAtual.km_inicial === null) {
      setMensagem(
        "Esta viagem foi iniciada sem KM inicial. Cancele este registro e inicie uma nova viagem com a quilometragem obrigatória."
      );
      setSalvando(false);
      return;
    }

    const kmInicialAtual = Number(viagemAtual.km_inicial);

    if (kmFinalNumero < kmInicialAtual) {
      setMensagem(
        `A quilometragem final não pode ser menor que a inicial (${kmInicialAtual.toLocaleString(
          "pt-BR"
        )} km).`
      );
      setSalvando(false);
      return;
    }

    const { error } = await supabase
      .from("viagens")
      .update({
        status: "Finalizada",
        km_final: kmFinalNumero,
        finalizado_em: new Date().toISOString(),
        observacao_final:
          observacaoFinal.trim() || null,
      })
      .eq("id", finalizando.id)
      .eq("status", "Em viagem");

    if (error) {
      setMensagem(
        `Erro ao finalizar viagem: ${error.message}`
      );
      setSalvando(false);
      return;
    }

    const viagemFinalizada = {
      ...finalizando,
      ...viagemAtual,
    } as Viagem;

    setFinalizando(null);
    setKmFinal("");
    setObservacaoFinal("");

    await carregarDados(true);
    setAgora(new Date());

    setMensagem(
      mensagemFinalizacao(viagemFinalizada)
    );

    setSalvando(false);
  }

  async function cancelarViagem(viagem: Viagem) {
    const confirmar = window.confirm(
      `Deseja cancelar o deslocamento de ${obterNomeMotorista(
        viagem.motorista_id
      )} para ${viagem.destino}?`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("viagens")
      .update({
        status: "Cancelada",
        finalizado_em: new Date().toISOString(),
      })
      .eq("id", viagem.id);

    if (error) {
      setMensagem(
        `Erro ao cancelar viagem: ${error.message}`
      );
      return;
    }

    await carregarDados();
    setMensagem("Deslocamento cancelado.");
  }

  async function excluirViagem(viagem: Viagem) {
    const confirmar = window.confirm(
      "Deseja excluir definitivamente este histórico?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("viagens")
      .delete()
      .eq("id", viagem.id);

    if (error) {
      setMensagem(
        `Erro ao excluir viagem: ${error.message}`
      );
      return;
    }

    await carregarDados();
    setMensagem("Histórico excluído com sucesso.");
  }

  function obterMotorista(id: string) {
    return (
      motoristas.find(
        (motorista) => motorista.id === id
      ) ?? null
    );
  }

  function obterNomeMotorista(id: string) {
    return obterMotorista(id)?.nome ?? "Motorista";
  }

  function obterVeiculo(id: string) {
    return (
      veiculos.find(
        (veiculo) => veiculo.id === id
      ) ?? null
    );
  }

  const viagensEmAndamento = viagens.filter(
    (viagem) => viagem.status === "Em viagem"
  );

  const viagensFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return viagens.filter((viagem) => {
      const motorista = motoristas.find(
        (item) => item.id === viagem.motorista_id
      );

      const veiculo = veiculos.find(
        (item) => item.id === viagem.veiculo_id
      );

      const correspondeStatus =
        !filtroStatus ||
        viagem.status === filtroStatus;

      const correspondeTipo =
        !filtroTipo ||
        viagem.tipo_viagem === filtroTipo;

      const correspondeMotivo =
        !filtroMotivo ||
        viagem.motivo_deslocamento === filtroMotivo;

      const correspondeMotorista =
        !filtroMotorista ||
        viagem.motorista_id === filtroMotorista;

      const correspondeVeiculo =
        !filtroVeiculo ||
        viagem.veiculo_id === filtroVeiculo;

      const correspondeBusca =
        !termo ||
        viagem.local_carregamento
          .toLowerCase()
          .includes(termo) ||
        viagem.destino
          .toLowerCase()
          .includes(termo) ||
        (viagem.cliente ?? "")
          .toLowerCase()
          .includes(termo) ||
        (viagem.motivo_deslocamento ?? "")
          .toLowerCase()
          .includes(termo) ||
        (motorista?.nome ?? "")
          .toLowerCase()
          .includes(termo) ||
        (veiculo?.placa ?? "")
          .toLowerCase()
          .includes(termo);

      return (
        correspondeStatus &&
        correspondeTipo &&
        correspondeMotivo &&
        correspondeMotorista &&
        correspondeVeiculo &&
        correspondeBusca
      );
    });
  }, [
    viagens,
    busca,
    filtroStatus,
    filtroTipo,
    filtroMotivo,
    filtroMotorista,
    filtroVeiculo,
    motoristas,
    veiculos,
  ]);

  const finalizadas = viagens.filter(
    (viagem) => viagem.status === "Finalizada"
  );

  const canceladas = viagens.filter(
    (viagem) => viagem.status === "Cancelada"
  ).length;

  const viagensCarregadas = finalizadas.filter(
    (viagem) => viagem.tipo_viagem === "Carregado"
  );

  const viagensVazias = finalizadas.filter(
    (viagem) => viagem.tipo_viagem === "Vazio"
  );

  const deslocamentosInternos = finalizadas.filter(
    (viagem) =>
      viagem.tipo_viagem === "Deslocamento interno"
  );

  const quilometragemCarregada =
    calcularQuilometragemTotal(viagensCarregadas);

  const quilometragemVazia =
    calcularQuilometragemTotal(viagensVazias);

  const quilometragemInterna =
    calcularQuilometragemTotal(deslocamentosInternos);

  const quilometragemTotal =
    quilometragemCarregada +
    quilometragemVazia +
    quilometragemInterna;

  const quilometragemSemCarga =
    quilometragemVazia + quilometragemInterna;

  const percentualSemCarga =
    quilometragemTotal > 0
      ? (quilometragemSemCarga /
          quilometragemTotal) *
        100
      : 0;

  const percentualProdutivo =
    quilometragemTotal > 0
      ? (quilometragemCarregada /
          quilometragemTotal) *
        100
      : 0;

  const resumoMotivos = motivosDeslocamento.map(
    (motivo) => {
      const registros = deslocamentosInternos.filter(
        (viagem) =>
          viagem.motivo_deslocamento === motivo
      );

      return {
        motivo,
        quantidade: registros.length,
        quilometragem:
          calcularQuilometragemTotal(registros),
      };
    }
  );

  if (!sessaoPronta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-500">
            NOBRE
          </div>

          <p className="mt-4 font-semibold">
            Restaurando sua sessão...
          </p>

          <p className="mt-2 text-sm text-slate-500">
            As viagens serão exibidas assim que seu acesso for confirmado.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-28 text-slate-900 sm:p-6 sm:pb-28 md:p-8 md:pb-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Viagens e deslocamentos
            </h1>

            <p className="mt-1 text-slate-500">
              Controle de operação carregada, retorno vazio
              e deslocamentos internos.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              href="/viagens/indicadores"
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center font-semibold text-blue-700 sm:w-auto"
            >
              📊 Indicadores detalhados
            </Link>

            <Link
              href="/"
              className="w-full rounded-xl border bg-white px-5 py-3 text-center font-semibold sm:w-auto"
            >
              Voltar ao Dashboard
            </Link>

            <Link
              href="/viagens/nova"
              className="w-full rounded-xl bg-amber-400 px-5 py-4 text-center font-bold sm:w-auto sm:py-3"
            >
              + Iniciar deslocamento
            </Link>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">
          <CardResumo
            titulo="Total"
            valor={viagens.length}
          />

          <CardResumo
            titulo="Em andamento"
            valor={viagensEmAndamento.length}
            destaque={viagensEmAndamento.length > 0}
          />

          <CardResumo
            titulo="KM carregado"
            valor={quilometragemCarregada}
            sufixo=" km"
          />

          <CardResumo
            titulo="KM indo carregar"
            valor={quilometragemVazia}
            sufixo=" km"
          />

          <CardResumo
            titulo="KM interno"
            valor={quilometragemInterna}
            sufixo=" km"
          />

          <CardResumo
            titulo="KM total"
            valor={quilometragemTotal}
            sufixo=" km"
          />

          <CardResumo
            titulo="% produtivo"
            valor={Number(
              percentualProdutivo.toFixed(1)
            )}
            sufixo="%"
          />

          <CardResumo
            titulo="% sem carga"
            valor={Number(
              percentualSemCarga.toFixed(1)
            )}
            sufixo="%"
            destaque={percentualSemCarga > 35}
          />
        </section>

        {mensagem && (
          <div className="mt-6 rounded-xl border bg-white px-4 py-3">
            {mensagem}
          </div>
        )}

        {finalizando && (
          <form
            onSubmit={finalizarViagem}
            className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Finalizar deslocamento
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {obterNomeMotorista(
                    finalizando.motorista_id
                  )}{" "}
                  • {finalizando.local_carregamento} →{" "}
                  {finalizando.destino}
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {rotuloTipo(finalizando)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFinalizando(null)}
                className="text-slate-500"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Campo titulo="Quilometragem final">
                <input
                  required
                  type="number"
                  min={finalizando.km_inicial ?? 0}
                  step="0.1"
                  inputMode="decimal"
                  value={kmFinal}
                  onChange={(evento) =>
                    setKmFinal(evento.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Observação final">
                <input
                  value={observacaoFinal}
                  onChange={(evento) =>
                    setObservacaoFinal(
                      evento.target.value
                    )
                  }
                  placeholder={placeholderFinalizacao(
                    finalizando
                  )}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="mt-5 w-full rounded-xl bg-green-600 px-5 py-4 font-bold text-white sm:w-auto sm:py-3"
            >
              ✅ Confirmar finalização
            </button>
          </form>
        )}

        <section className="mt-6">
          <h2 className="text-2xl font-bold">
            Operações em andamento
          </h2>

          <p className="mt-1 text-slate-500">
            Situação atual de cada motorista e caminhão.
          </p>

          {viagensEmAndamento.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-white p-6 text-slate-500">
              Nenhum deslocamento em andamento.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {viagensEmAndamento.map((viagem) => {
                const motorista = obterMotorista(
                  viagem.motorista_id
                );

                const veiculo = obterVeiculo(
                  viagem.veiculo_id
                );

                return (
                  <article
                    key={viagem.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-6 ${classeBordaTipo(
                      viagem.tipo_viagem
                    )}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${classeEtiquetaTipo(
                            viagem.tipo_viagem
                          )}`}
                        >
                          {statusEmAndamento(viagem)}
                        </span>

                        <h3 className="mt-4 text-xl font-bold">
                          {viagem.local_carregamento} →{" "}
                          {viagem.destino}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {descricaoSecundaria(viagem)}
                        </p>
                      </div>

                      <div className="w-full rounded-xl bg-slate-950 px-4 py-3 text-center text-white sm:w-auto">
                        <p className="text-xs text-slate-300">
                          Tempo em deslocamento
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {formatarDuracao(
                            viagem.iniciado_em,
                            null,
                            agora
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Informacao
                        titulo="Motorista"
                        valor={
                          motorista?.nome ??
                          "Não encontrado"
                        }
                      />

                      <Informacao
                        titulo="Caminhão"
                        valor={
                          veiculo
                            ? `${veiculo.placa} — ${veiculo.marca} ${veiculo.modelo}`
                            : "Não encontrado"
                        }
                      />

                      <Informacao
                        titulo="Início"
                        valor={formatarDataHora(
                          viagem.iniciado_em
                        )}
                      />

                      <Informacao
                        titulo="KM inicial"
                        valor={
                          viagem.km_inicial !== null
                            ? `${Number(
                                viagem.km_inicial
                              ).toLocaleString(
                                "pt-BR"
                              )} km`
                            : "Não informado"
                        }
                      />
                    </div>

                    {viagem.observacao_inicio && (
                      <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
                        {viagem.observacao_inicio}
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          abrirFinalizacao(viagem)
                        }
                        className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white"
                      >
                        ✅ Finalizar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          cancelarViagem(viagem)
                        }
                        className="rounded-xl bg-slate-700 px-4 py-3 font-bold text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">
              Resumo de deslocamentos internos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Quilometragem fora da operação de carga.
            </p>

            <div className="mt-5 space-y-4">
              {resumoMotivos.map((item) => (
                <div
                  key={item.motivo}
                  className="flex items-center justify-between rounded-xl border bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {item.motivo}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.quantidade} deslocamento(s)
                    </p>
                  </div>

                  <strong>
                    {item.quilometragem.toLocaleString(
                      "pt-BR"
                    )}{" "}
                    km
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">
              Indicadores operacionais
            </h2>

            <div className="mt-5 space-y-4">
              <Indicador
                titulo="Viagens carregadas"
                valor={String(
                  viagensCarregadas.length
                )}
              />

              <Indicador
                titulo="Retornos vazios para carga"
                valor={String(viagensVazias.length)}
              />

              <Indicador
                titulo="Deslocamentos internos"
                valor={String(
                  deslocamentosInternos.length
                )}
              />

              <Indicador
                titulo="Operações finalizadas"
                valor={String(finalizadas.length)}
              />

              <Indicador
                titulo="Operações canceladas"
                valor={String(canceladas)}
              />

              <Indicador
                titulo="Percentual produtivo"
                valor={`${percentualProdutivo.toFixed(
                  1
                )}%`}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  Histórico completo
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {viagensFiltradas.length} registro(s)
                  encontrado(s).
                </p>
              </div>

              <div className="grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap">
                <input
                  value={busca}
                  onChange={(evento) =>
                    setBusca(evento.target.value)
                  }
                  placeholder="Buscar rota, cliente ou motivo..."
                  className="w-full rounded-xl border px-4 py-3 sm:w-auto"
                />

                <select
                  value={filtroTipo}
                  onChange={(evento) => {
                    setFiltroTipo(evento.target.value);

                    if (
                      evento.target.value !==
                      "Deslocamento interno"
                    ) {
                      setFiltroMotivo("");
                    }
                  }}
                  className="w-full rounded-xl border px-4 py-3 sm:w-auto"
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

                {filtroTipo ===
                  "Deslocamento interno" && (
                  <select
                    value={filtroMotivo}
                    onChange={(evento) =>
                      setFiltroMotivo(
                        evento.target.value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3 sm:w-auto"
                  >
                    <option value="">
                      Todos os motivos
                    </option>

                    {motivosDeslocamento.map(
                      (motivo) => (
                        <option
                          key={motivo}
                          value={motivo}
                        >
                          {motivo}
                        </option>
                      )
                    )}
                  </select>
                )}

                <select
                  value={filtroStatus}
                  onChange={(evento) =>
                    setFiltroStatus(evento.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3 sm:w-auto"
                >
                  <option value="">
                    Todos os status
                  </option>

                  <option value="Em viagem">
                    Em andamento
                  </option>

                  <option value="Finalizada">
                    Finalizadas
                  </option>

                  <option value="Cancelada">
                    Canceladas
                  </option>
                </select>

                <select
                  value={filtroMotorista}
                  onChange={(evento) =>
                    setFiltroMotorista(
                      evento.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3 sm:w-auto"
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

                <select
                  value={filtroVeiculo}
                  onChange={(evento) =>
                    setFiltroVeiculo(
                      evento.target.value
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3 sm:w-auto"
                >
                  <option value="">
                    Todos os caminhões
                  </option>

                  {veiculos.map((veiculo) => (
                    <option
                      key={veiculo.id}
                      value={veiculo.id}
                    >
                      {veiculo.placa}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {carregando ? (
            <p className="p-6 text-slate-500">
              Carregando registros...
            </p>
          ) : viagensFiltradas.length === 0 ? (
            <p className="p-6 text-slate-500">
              Nenhum registro encontrado.
            </p>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {viagensFiltradas.map((viagem) => {
                  const veiculo = obterVeiculo(viagem.veiculo_id);

                  return (
                    <article
                      key={viagem.id}
                      className="rounded-2xl border bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${classeEtiquetaTipo(
                            viagem.tipo_viagem
                          )}`}
                        >
                          {nomeCurtoTipo(viagem.tipo_viagem)}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                            viagem.status
                          )}`}
                        >
                          {viagem.status}
                        </span>
                      </div>

                      <h3 className="mt-4 text-lg font-bold">
                        {viagem.local_carregamento} → {viagem.destino}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {descricaoSecundaria(viagem)}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <Informacao
                          titulo="Motorista"
                          valor={obterNomeMotorista(viagem.motorista_id)}
                        />

                        <Informacao
                          titulo="Caminhão"
                          valor={veiculo?.placa ?? "Não encontrado"}
                        />

                        <Informacao
                          titulo="Início"
                          valor={formatarDataHora(viagem.iniciado_em)}
                        />

                        <Informacao
                          titulo="Distância"
                          valor={calcularDistancia(viagem)}
                        />
                      </div>

                      {viagem.motivo_deslocamento && (
                        <p className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">
                          Motivo: {viagem.motivo_deslocamento}
                        </p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {viagem.status === "Em viagem" && (
                          <button
                            type="button"
                            onClick={() => abrirFinalizacao(viagem)}
                            className="rounded-xl bg-green-600 px-3 py-3 font-bold text-white"
                          >
                            Finalizar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => excluirViagem(viagem)}
                          className={`rounded-xl bg-red-600 px-3 py-3 font-bold text-white ${
                            viagem.status !== "Em viagem"
                              ? "col-span-2"
                              : ""
                          }`}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                <thead className="bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-4 py-4">
                      Tipo
                    </th>
                    <th className="px-4 py-4">
                      Motivo
                    </th>
                    <th className="px-4 py-4">
                      Motorista
                    </th>
                    <th className="px-4 py-4">
                      Caminhão
                    </th>
                    <th className="px-4 py-4">
                      Rota
                    </th>
                    <th className="px-4 py-4">
                      Início
                    </th>
                    <th className="px-4 py-4">
                      Término
                    </th>
                    <th className="px-4 py-4">
                      Duração
                    </th>
                    <th className="px-4 py-4">
                      Distância
                    </th>
                    <th className="px-4 py-4">
                      Status
                    </th>
                    <th className="px-4 py-4">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {viagensFiltradas.map((viagem) => {
                    const veiculo = obterVeiculo(
                      viagem.veiculo_id
                    );

                    return (
                      <tr
                        key={viagem.id}
                        className="border-t"
                      >
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${classeEtiquetaTipo(
                              viagem.tipo_viagem
                            )}`}
                          >
                            {nomeCurtoTipo(
                              viagem.tipo_viagem
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {viagem.motivo_deslocamento ??
                            "—"}
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {obterNomeMotorista(
                            viagem.motorista_id
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {veiculo?.placa ??
                            "Não encontrado"}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {viagem.local_carregamento} →{" "}
                            {viagem.destino}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {descricaoSecundaria(viagem)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {formatarDataHora(
                            viagem.iniciado_em
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {viagem.finalizado_em
                            ? formatarDataHora(
                                viagem.finalizado_em
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          {formatarDuracao(
                            viagem.iniciado_em,
                            viagem.finalizado_em,
                            agora
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {calcularDistancia(viagem)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                              viagem.status
                            )}`}
                          >
                            {viagem.status}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {viagem.status ===
                              "Em viagem" && (
                              <button
                                type="button"
                                onClick={() =>
                                  abrirFinalizacao(
                                    viagem
                                  )
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                              >
                                Finalizar
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                excluirViagem(viagem)
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
            </>
          )}
        </section>
      </div>

      <MobileNav />
    </main>
  );
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

    return (
      total +
      (Number(viagem.km_final) -
        Number(viagem.km_inicial))
    );
  }, 0);
}

function mensagemFinalizacao(viagem: Viagem) {
  if (viagem.tipo_viagem === "Carregado") {
    return "Viagem carregada finalizada. O caminhão foi descarregado.";
  }

  if (viagem.tipo_viagem === "Vazio") {
    return "Deslocamento vazio finalizado. O caminhão chegou ao carregamento.";
  }

  return `Deslocamento interno finalizado: ${
    viagem.motivo_deslocamento ?? "Outro"
  }.`;
}

function classeBordaTipo(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "border-red-200";
  }

  if (tipo === "Vazio") {
    return "border-orange-200";
  }

  return "border-blue-200";
}

function classeEtiquetaTipo(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "bg-red-100 text-red-700";
  }

  if (tipo === "Vazio") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-blue-100 text-blue-700";
}

function statusEmAndamento(viagem: Viagem) {
  if (viagem.tipo_viagem === "Carregado") {
    return "🔴 Carregado — Em viagem";
  }

  if (viagem.tipo_viagem === "Vazio") {
    return "🟠 Vazio — Indo carregar";
  }

  return `🔵 Deslocamento interno — ${
    viagem.motivo_deslocamento ?? "Outro"
  }`;
}

function rotuloTipo(viagem: Viagem) {
  if (viagem.tipo_viagem === "Carregado") {
    return "🔴 Viagem carregada";
  }

  if (viagem.tipo_viagem === "Vazio") {
    return "🟠 Viagem vazia — indo carregar";
  }

  return `🔵 Deslocamento interno — ${
    viagem.motivo_deslocamento ?? "Outro"
  }`;
}

function descricaoSecundaria(viagem: Viagem) {
  if (viagem.tipo_viagem === "Carregado") {
    return viagem.cliente || "Cliente não informado";
  }

  if (viagem.tipo_viagem === "Vazio") {
    return "Deslocamento vazio para carregamento";
  }

  return viagem.motivo_deslocamento
    ? `Motivo: ${viagem.motivo_deslocamento}`
    : "Deslocamento interno";
}

function nomeCurtoTipo(tipo: TipoViagem) {
  if (tipo === "Deslocamento interno") {
    return "Interno";
  }

  return tipo;
}

function placeholderFinalizacao(viagem: Viagem) {
  if (viagem.tipo_viagem === "Carregado") {
    return "Carga descarregada, ocorrência...";
  }

  if (viagem.tipo_viagem === "Vazio") {
    return "Chegou ao carregamento, ocorrência...";
  }

  return `${viagem.motivo_deslocamento ?? "Deslocamento"} concluído...`;
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

function Informacao({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">
        {titulo}
      </p>

      <p className="mt-1 font-semibold">{valor}</p>
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
    <div className="flex items-center justify-between border-b pb-3 last:border-b-0">
      <span className="text-sm text-slate-500">
        {titulo}
      </span>

      <strong>{valor}</strong>
    </div>
  );
}

function CardResumo({
  titulo,
  valor,
  sufixo = "",
  destaque = false,
}: {
  titulo: string;
  valor: number;
  sufixo?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${
        destaque
          ? "border-red-200 bg-red-50"
          : "bg-white"
      }`}
    >
      <p className="text-xs text-slate-500 sm:text-sm">
        {titulo}
      </p>

      <p
        className={`mt-2 break-words text-xl font-bold sm:text-2xl ${
          destaque
            ? "text-red-700"
            : "text-slate-900"
        }`}
      >
        {valor.toLocaleString("pt-BR")}
        {sufixo}
      </p>
    </div>
  );
}

function formatarDataHora(dataTexto: string) {
  return new Date(dataTexto).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarDuracao(
  inicioTexto: string,
  finalTexto: string | null,
  agora: Date
) {
  const inicio = new Date(inicioTexto).getTime();

  const final = finalTexto
    ? new Date(finalTexto).getTime()
    : agora.getTime();

  const totalSegundos = Math.max(
    0,
    Math.floor((final - inicio) / 1000)
  );

  const dias = Math.floor(totalSegundos / 86400);

  const horas = Math.floor(
    (totalSegundos % 86400) / 3600
  );

  const minutos = Math.floor(
    (totalSegundos % 3600) / 60
  );

  const segundos = totalSegundos % 60;

  if (dias > 0) {
    return `${dias}d ${horas}h ${minutos}min`;
  }

  return `${String(horas).padStart(2, "0")}:${String(
    minutos
  ).padStart(2, "0")}:${String(segundos).padStart(
    2,
    "0"
  )}`;
}

function calcularDistancia(viagem: Viagem) {
  if (
    viagem.km_inicial === null ||
    viagem.km_final === null
  ) {
    return "—";
  }

  return `${(
    Number(viagem.km_final) -
    Number(viagem.km_inicial)
  ).toLocaleString("pt-BR")} km`;
}

function classeStatus(status: StatusViagem) {
  if (status === "Em viagem") {
    return "bg-red-100 text-red-700";
  }

  if (status === "Finalizada") {
    return "bg-green-100 text-green-700";
  }

  return "bg-slate-200 text-slate-700";
}