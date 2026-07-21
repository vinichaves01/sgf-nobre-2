"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
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

const formularioInicial = {
  motorista_id: "",
  veiculo_id: "",
  tipo_viagem: "Carregado" as TipoViagem,
  motivo_deslocamento: "" as MotivoDeslocamento | "",
  local_carregamento: "",
  destino: "",
  cliente: "",
  km_inicial: "",
  observacao_inicio: "",
};

export default function ViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [finalizando, setFinalizando] =
    useState<Viagem | null>(null);

  const [kmFinal, setKmFinal] = useState("");
  const [observacaoFinal, setObservacaoFinal] =
    useState("");

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

  async function carregarDados() {
    setCarregando(true);

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
        `Erro ao carregar veículos: ${resultadoVeiculos.error.message}`
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

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setAgora(new Date());
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, []);

  function abrirNovaViagem() {
    setFormulario(formularioInicial);
    setMensagem("");
    setMostrarFormulario(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    setFormulario(formularioInicial);
  }

  function alterarTipoViagem(tipo: TipoViagem) {
    setFormulario({
      ...formulario,
      tipo_viagem: tipo,
      cliente:
        tipo === "Carregado"
          ? formulario.cliente
          : "",
      motivo_deslocamento:
        tipo === "Deslocamento interno"
          ? formulario.motivo_deslocamento
          : "",
    });
  }

  function alterarMotorista(motoristaId: string) {
    const motorista = motoristas.find(
      (item) => item.id === motoristaId
    );

    setFormulario({
      ...formulario,
      motorista_id: motoristaId,
      veiculo_id:
        motorista?.tipo_motorista === "Fixo"
          ? motorista.veiculo_id ?? ""
          : "",
    });
  }

  async function iniciarViagem(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setSalvando(true);
    setMensagem("");

    const motorista = motoristas.find(
      (item) => item.id === formulario.motorista_id
    );

    if (!motorista) {
      setMensagem("Selecione um motorista.");
      setSalvando(false);
      return;
    }

    if (!formulario.veiculo_id) {
      setMensagem("Selecione o caminhão da viagem.");
      setSalvando(false);
      return;
    }

    if (
      formulario.tipo_viagem ===
        "Deslocamento interno" &&
      !formulario.motivo_deslocamento
    ) {
      setMensagem(
        "Selecione o motivo do deslocamento interno."
      );
      setSalvando(false);
      return;
    }

    const motoristaOcupado = viagens.some(
      (viagem) =>
        viagem.motorista_id === formulario.motorista_id &&
        viagem.status === "Em viagem"
    );

    if (motoristaOcupado) {
      setMensagem(
        "Este motorista já possui uma viagem em andamento."
      );
      setSalvando(false);
      return;
    }

    const veiculoOcupado = viagens.some(
      (viagem) =>
        viagem.veiculo_id === formulario.veiculo_id &&
        viagem.status === "Em viagem"
    );

    if (veiculoOcupado) {
      setMensagem(
        "Este caminhão já está sendo utilizado em outra viagem."
      );
      setSalvando(false);
      return;
    }

    const dados = {
      motorista_id: formulario.motorista_id,
      veiculo_id: formulario.veiculo_id,
      tipo_viagem: formulario.tipo_viagem,
      motivo_deslocamento:
        formulario.tipo_viagem ===
        "Deslocamento interno"
          ? formulario.motivo_deslocamento
          : null,
      local_carregamento:
        formulario.local_carregamento.trim(),
      destino: formulario.destino.trim(),
      cliente:
        formulario.tipo_viagem === "Carregado"
          ? formulario.cliente.trim() || null
          : null,
      km_inicial: formulario.km_inicial
        ? Number(formulario.km_inicial)
        : null,
      observacao_inicio:
        formulario.observacao_inicio.trim() || null,
      status: "Em viagem" as StatusViagem,
      iniciado_em: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("viagens")
      .insert(dados);

    if (error) {
      if (error.code === "23505") {
        setMensagem(
          "O motorista ou o caminhão já possui uma viagem em andamento."
        );
      } else {
        setMensagem(
          `Erro ao iniciar viagem: ${error.message}`
        );
      }

      setSalvando(false);
      return;
    }

    fecharFormulario();
    await carregarDados();

    setMensagem(
      mensagemInicioViagem(formulario.tipo_viagem)
    );

    setSalvando(false);
  }

  function abrirFinalizacao(viagem: Viagem) {
    setFinalizando(viagem);

    setKmFinal(
      viagem.km_inicial !== null
        ? String(viagem.km_inicial)
        : ""
    );

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

    const kmFinalNumero = kmFinal
      ? Number(kmFinal)
      : null;

    if (
      kmFinalNumero !== null &&
      finalizando.km_inicial !== null &&
      kmFinalNumero < finalizando.km_inicial
    ) {
      setMensagem(
        "A quilometragem final não pode ser menor que a inicial."
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
      .eq("id", finalizando.id);

    if (error) {
      setMensagem(
        `Erro ao finalizar viagem: ${error.message}`
      );
      setSalvando(false);
      return;
    }

    const viagemFinalizada = finalizando;

    setFinalizando(null);
    setKmFinal("");
    setObservacaoFinal("");

    await carregarDados();

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

  const veiculosOcupados = new Set(
    viagensEmAndamento.map(
      (viagem) => viagem.veiculo_id
    )
  );

  const motoristasOcupados = new Set(
    viagensEmAndamento.map(
      (viagem) => viagem.motorista_id
    )
  );

  const motoristasDisponiveis = motoristas.filter(
    (motorista) =>
      motorista.status === "Ativo" &&
      (!motoristasOcupados.has(motorista.id) ||
        motorista.id === formulario.motorista_id)
  );

  const veiculosDisponiveis = veiculos.filter(
    (veiculo) =>
      !veiculosOcupados.has(veiculo.id) ||
      veiculo.id === formulario.veiculo_id
  );

  const motoristaSelecionado = motoristas.find(
    (motorista) =>
      motorista.id === formulario.motorista_id
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

            <button
              onClick={abrirNovaViagem}
              className="w-full rounded-xl bg-amber-400 px-5 py-4 text-center font-bold sm:w-auto sm:py-3"
            >
              + Iniciar deslocamento
            </button>
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

        {mostrarFormulario && (
          <form
            onSubmit={iniciarViagem}
            className="mt-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Iniciar deslocamento
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Selecione a situação operacional do
                  caminhão.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharFormulario}
                className="text-slate-500"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Campo titulo="Tipo de deslocamento">
                <select
                  value={formulario.tipo_viagem}
                  onChange={(evento) =>
                    alterarTipoViagem(
                      evento.target.value as TipoViagem
                    )
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="Carregado">
                    🔴 Carregado — indo descarregar
                  </option>

                  <option value="Vazio">
                    🟠 Vazio — indo carregar
                  </option>

                  <option value="Deslocamento interno">
                    🔵 Fora de operação / deslocamento interno
                  </option>
                </select>
              </Campo>

              {formulario.tipo_viagem ===
                "Deslocamento interno" && (
                <Campo titulo="Motivo obrigatório">
                  <select
                    required
                    value={
                      formulario.motivo_deslocamento
                    }
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        motivo_deslocamento:
                          evento.target
                            .value as MotivoDeslocamento,
                      })
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    <option value="">
                      Selecione o motivo
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
                </Campo>
              )}

              <Campo titulo="Motorista">
                <select
                  required
                  value={formulario.motorista_id}
                  onChange={(evento) =>
                    alterarMotorista(evento.target.value)
                  }
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">
                    Selecione o motorista
                  </option>

                  {motoristasDisponiveis.map(
                    (motorista) => (
                      <option
                        key={motorista.id}
                        value={motorista.id}
                      >
                        {motorista.nome} —{" "}
                        {motorista.tipo_motorista}
                      </option>
                    )
                  )}
                </select>
              </Campo>

              <Campo titulo="Caminhão">
                <select
                  required
                  disabled={
                    !formulario.motorista_id ||
                    motoristaSelecionado?.tipo_motorista ===
                      "Fixo"
                  }
                  value={formulario.veiculo_id}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      veiculo_id:
                        evento.target.value,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-100"
                >
                  <option value="">
                    Selecione o caminhão
                  </option>

                  {veiculosDisponiveis.map((veiculo) => (
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

              {formulario.tipo_viagem === "Carregado" && (
                <Campo titulo="Cliente">
                  <input
                    value={formulario.cliente}
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        cliente: evento.target.value,
                      })
                    }
                    placeholder="Nome do cliente"
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </Campo>
              )}

              <Campo
                titulo={tituloOrigem(
                  formulario.tipo_viagem
                )}
              >
                <input
                  required
                  value={
                    formulario.local_carregamento
                  }
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      local_carregamento:
                        evento.target.value,
                    })
                  }
                  placeholder={placeholderOrigem(
                    formulario.tipo_viagem
                  )}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo
                titulo={tituloDestino(
                  formulario.tipo_viagem
                )}
              >
                <input
                  required
                  value={formulario.destino}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      destino:
                        evento.target.value,
                    })
                  }
                  placeholder={placeholderDestino(
                    formulario.tipo_viagem,
                    formulario.motivo_deslocamento
                  )}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo titulo="Quilometragem inicial">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formulario.km_inicial}
                  onChange={(evento) =>
                    setFormulario({
                      ...formulario,
                      km_inicial:
                        evento.target.value,
                    })
                  }
                  placeholder="KM atual do painel"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <div className="md:col-span-2 xl:col-span-3">
                <Campo titulo="Observação inicial">
                  <textarea
                    rows={3}
                    value={
                      formulario.observacao_inicio
                    }
                    onChange={(evento) =>
                      setFormulario({
                        ...formulario,
                        observacao_inicio:
                          evento.target.value,
                      })
                    }
                    placeholder="Carga, documento, manutenção, ocorrência ou informação importante..."
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </Campo>
              </div>
            </div>

            <AvisoTipo
              tipo={formulario.tipo_viagem}
              motivo={
                formulario.motivo_deslocamento ||
                null
              }
            />

            {motoristaSelecionado?.tipo_motorista ===
              "Folguista" && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                Este motorista é folguista. Selecione o
                caminhão disponível utilizado neste
                deslocamento.
              </div>
            )}

            {motoristaSelecionado?.tipo_motorista ===
              "Fixo" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                O caminhão fixo do motorista foi selecionado
                automaticamente.
              </div>
            )}

            <button
              disabled={salvando}
              className={`mt-6 w-full rounded-xl px-5 py-4 font-bold text-white disabled:opacity-60 sm:w-auto sm:py-3 ${classeBotaoTipo(
                formulario.tipo_viagem
              )}`}
            >
              {salvando
                ? "Iniciando..."
                : textoBotaoInicio(
                    formulario.tipo_viagem
                  )}
            </button>
          </form>
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
                  type="number"
                  min={finalizando.km_inicial ?? 0}
                  step="0.1"
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
                        onClick={() =>
                          abrirFinalizacao(viagem)
                        }
                        className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white"
                      >
                        ✅ Finalizar
                      </button>

                      <button
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

function mensagemInicioViagem(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "Viagem carregada iniciada com sucesso.";
  }

  if (tipo === "Vazio") {
    return "Deslocamento vazio para carregamento iniciado.";
  }

  return "Deslocamento interno iniciado com sucesso.";
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

function tituloOrigem(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "Local de carregamento";
  }

  return "Local de saída";
}

function tituloDestino(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "Destino de descarga";
  }

  if (tipo === "Vazio") {
    return "Destino de carregamento";
  }

  return "Destino do deslocamento";
}

function placeholderOrigem(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "Ex.: Ibiti";
  }

  if (tipo === "Vazio") {
    return "Ex.: Puma";
  }

  return "Ex.: Base da empresa";
}

function placeholderDestino(
  tipo: TipoViagem,
  motivo: MotivoDeslocamento | ""
) {
  if (tipo === "Carregado") {
    return "Ex.: Puma";
  }

  if (tipo === "Vazio") {
    return "Ex.: Ibiti";
  }

  if (motivo === "Manutenção") {
    return "Ex.: Oficina Mercedes";
  }

  if (motivo === "Retorno para casa") {
    return "Ex.: Garagem / residência";
  }

  if (motivo === "Abastecimento") {
    return "Ex.: Posto de combustível";
  }

  return "Informe o destino";
}

function AvisoTipo({
  tipo,
  motivo,
}: {
  tipo: TipoViagem;
  motivo: MotivoDeslocamento | null;
}) {
  if (tipo === "Carregado") {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        🔴 O caminhão está carregado e seguirá até o local
        de descarga.
      </div>
    );
  }

  if (tipo === "Vazio") {
    return (
      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
        🟠 O caminhão está vazio e seguirá para buscar uma
        nova carga.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
      🔵 O caminhão está fora da operação de carga
      {motivo ? ` — ${motivo}.` : "."}
    </div>
  );
}

function textoBotaoInicio(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "🔴 Começar viagem carregado";
  }

  if (tipo === "Vazio") {
    return "🟠 Começar viagem vazio";
  }

  return "🔵 Iniciar deslocamento interno";
}

function classeBotaoTipo(tipo: TipoViagem) {
  if (tipo === "Carregado") {
    return "bg-red-600";
  }

  if (tipo === "Vazio") {
    return "bg-orange-500";
  }

  return "bg-blue-600";
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