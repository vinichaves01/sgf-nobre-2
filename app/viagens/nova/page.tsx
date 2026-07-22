"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MobileNav from "@/components/MobileNav";

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

type ViagemEmAndamento = {
  id: string;
  motorista_id: string;
  veiculo_id: string;
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

export default function NovaViagemPage() {
  const router = useRouter();

  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [viagensEmAndamento, setViagensEmAndamento] = useState<
    ViagemEmAndamento[]
  >([]);

  const [formulario, setFormulario] = useState(formularioInicial);
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const carregarDados = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCarregando(true);
      }

      const {
        data: { session },
        error: erroSessao,
      } = await supabase.auth.getSession();

      if (erroSessao) {
        setMensagem(
          `Não foi possível recuperar sua sessão: ${erroSessao.message}`
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

      const [resultadoMotoristas, resultadoVeiculos, resultadoViagens] =
        await Promise.all([
          supabase
            .from("motoristas")
            .select("id, nome, tipo_motorista, veiculo_id, status")
            .order("nome", { ascending: true }),

          supabase
            .from("veiculos")
            .select("id, placa, marca, modelo, status")
            .order("placa", { ascending: true }),

          supabase
            .from("viagens")
            .select("id, motorista_id, veiculo_id")
            .eq("status", "Em viagem"),
        ]);

      const erros: string[] = [];

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

      if (resultadoViagens.error) {
        erros.push(
          `Operações em andamento: ${resultadoViagens.error.message}`
        );
      } else {
        setViagensEmAndamento(resultadoViagens.data ?? []);
      }

      if (erros.length > 0) {
        setMensagem(
          `Alguns dados não puderam ser carregados — ${erros.join(" | ")}`
        );
      } else {
        setMensagem("");
      }

      setCarregando(false);
    },
    [router]
  );

  useEffect(() => {
    let ativo = true;

    const atualizarSilenciosamente = () => {
      if (ativo) {
        void carregarDados(true);
      }
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
    };

    const canal = supabase
      .channel(`nova-viagem-tempo-real-${Date.now()}`)
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
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!ativo) return;

      if (!session) {
        setSessaoPronta(false);
        router.replace("/login");
        return;
      }

      setSessaoPronta(true);

      window.setTimeout(() => {
        atualizarSilenciosamente();
      }, 0);
    });

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        atualizarSilenciosamente();
      }
    };

    window.addEventListener("focus", atualizarSilenciosamente);
    document.addEventListener("visibilitychange", atualizarAoVoltar);

    void iniciar();

    return () => {
      ativo = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", atualizarSilenciosamente);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
      void supabase.removeChannel(canal);
    };
  }, [carregarDados, router]);

  function alterarTipoViagem(tipo: TipoViagem) {
    setFormulario((atual) => ({
      ...atual,
      tipo_viagem: tipo,
      cliente: tipo === "Carregado" ? atual.cliente : "",
      motivo_deslocamento:
        tipo === "Deslocamento interno"
          ? atual.motivo_deslocamento
          : "",
    }));
  }

  function alterarMotorista(motoristaId: string) {
    const motorista = motoristas.find(
      (item) => item.id === motoristaId
    );

    setFormulario((atual) => ({
      ...atual,
      motorista_id: motoristaId,
      veiculo_id:
        motorista?.tipo_motorista === "Fixo"
          ? motorista.veiculo_id ?? ""
          : "",
    }));
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
      formulario.tipo_viagem === "Deslocamento interno" &&
      !formulario.motivo_deslocamento
    ) {
      setMensagem(
        "Selecione o motivo do deslocamento interno."
      );
      setSalvando(false);
      return;
    }

    const motoristaOcupado = viagensEmAndamento.some(
      (viagem) =>
        viagem.motorista_id === formulario.motorista_id
    );

    if (motoristaOcupado) {
      setMensagem(
        "Este motorista já possui uma operação em andamento."
      );
      setSalvando(false);
      return;
    }

    const veiculoOcupado = viagensEmAndamento.some(
      (viagem) => viagem.veiculo_id === formulario.veiculo_id
    );

    if (veiculoOcupado) {
      setMensagem(
        "Este caminhão já está sendo utilizado em outra operação."
      );
      setSalvando(false);
      return;
    }

    const dados = {
      motorista_id: formulario.motorista_id,
      veiculo_id: formulario.veiculo_id,
      tipo_viagem: formulario.tipo_viagem,
      motivo_deslocamento:
        formulario.tipo_viagem === "Deslocamento interno"
          ? formulario.motivo_deslocamento
          : null,
      local_carregamento: formulario.local_carregamento.trim(),
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
      status: "Em viagem",
    };

    const { error } = await supabase
      .from("viagens")
      .insert(dados);

    if (error) {
      if (error.code === "23505") {
        setMensagem(
          "O motorista ou o caminhão já possui uma operação em andamento."
        );
      } else {
        setMensagem(
          `Erro ao iniciar deslocamento: ${error.message}`
        );
      }

      setSalvando(false);
      return;
    }

    router.replace("/viagens");
    router.refresh();
  }

  const motoristasOcupados = new Set(
    viagensEmAndamento.map((viagem) => viagem.motorista_id)
  );

  const veiculosOcupados = new Set(
    viagensEmAndamento.map((viagem) => viagem.veiculo_id)
  );

  const motoristasDisponiveis = motoristas.filter(
    (motorista) =>
      motorista.status === "Ativo" &&
      !motoristasOcupados.has(motorista.id)
  );

  const veiculosDisponiveis = veiculos.filter(
    (veiculo) =>
      veiculo.status === "Ativo" &&
      !veiculosOcupados.has(veiculo.id)
  );

  const motoristaSelecionado = motoristas.find(
    (motorista) => motorista.id === formulario.motorista_id
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
            Motoristas e caminhões serão carregados assim que seu acesso for confirmado.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-28 text-slate-900 sm:p-6 sm:pb-28 md:p-8 md:pb-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-600">
              Operação
            </p>

            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
              Iniciar deslocamento
            </h1>

            <p className="mt-2 text-slate-500">
              Preencha os dados da nova operação.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:flex sm:w-auto">
            <Link
              href="/viagens"
              className="w-full rounded-xl border bg-white px-5 py-3 text-center font-semibold sm:w-auto"
            >
              Voltar para Viagens
            </Link>

            <Link
              href="/"
              className="w-full rounded-xl border bg-white px-5 py-3 text-center font-semibold sm:w-auto"
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </header>

        {mensagem && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {mensagem}
          </div>
        )}

        {carregando ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-500 shadow-sm">
            Carregando motoristas e caminhões...
          </div>
        ) : (
          <form
            onSubmit={iniciarViagem}
            className="mt-6 rounded-2xl border bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="grid gap-5 md:grid-cols-2">
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
                    value={formulario.motivo_deslocamento}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        motivo_deslocamento:
                          evento.target.value as MotivoDeslocamento,
                      }))
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    <option value="">
                      Selecione o motivo
                    </option>

                    {motivosDeslocamento.map((motivo) => (
                      <option key={motivo} value={motivo}>
                        {motivo}
                      </option>
                    ))}
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
                    {motoristasDisponiveis.length > 0
                      ? "Selecione o motorista"
                      : "Nenhum motorista disponível"}
                  </option>

                  {motoristasDisponiveis.map((motorista) => (
                    <option
                      key={motorista.id}
                      value={motorista.id}
                    >
                      {motorista.nome} —{" "}
                      {motorista.tipo_motorista}
                    </option>
                  ))}
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
                    setFormulario((atual) => ({
                      ...atual,
                      veiculo_id: evento.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-100"
                >
                  <option value="">
                    {veiculosDisponiveis.length > 0
                      ? "Selecione o caminhão"
                      : "Nenhum caminhão disponível"}
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
                      setFormulario((atual) => ({
                        ...atual,
                        cliente: evento.target.value,
                      }))
                    }
                    placeholder="Nome do cliente"
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </Campo>
              )}

              <Campo titulo={tituloOrigem(formulario.tipo_viagem)}>
                <input
                  required
                  value={formulario.local_carregamento}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      local_carregamento: evento.target.value,
                    }))
                  }
                  placeholder={placeholderOrigem(
                    formulario.tipo_viagem
                  )}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <Campo
                titulo={tituloDestino(formulario.tipo_viagem)}
              >
                <input
                  required
                  value={formulario.destino}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      destino: evento.target.value,
                    }))
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
                  inputMode="decimal"
                  value={formulario.km_inicial}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      km_inicial: evento.target.value,
                    }))
                  }
                  placeholder="KM atual do painel"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </Campo>

              <div className="md:col-span-2">
                <Campo titulo="Observação inicial">
                  <textarea
                    rows={4}
                    value={formulario.observacao_inicio}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        observacao_inicio: evento.target.value,
                      }))
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
                formulario.motivo_deslocamento || null
              }
            />

            {motoristasDisponiveis.length === 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Nenhum motorista está disponível. Verifique se os motoristas estão ativos e se não existe outra operação em andamento.
              </div>
            )}

            {veiculosDisponiveis.length === 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Nenhum caminhão está disponível. Verifique se os veículos estão ativos e se não existe outra operação em andamento.
              </div>
            )}

            {motoristaSelecionado?.tipo_motorista ===
              "Folguista" && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                Este motorista é folguista. Selecione o
                caminhão disponível usado nesta operação.
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
              type="submit"
              disabled={salvando}
              className={`mt-6 w-full rounded-xl px-5 py-4 font-bold text-white disabled:opacity-60 sm:w-auto ${classeBotaoTipo(
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
      </div>

      <MobileNav />
    </main>
  );
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
      <span className="mb-2 block text-sm font-medium text-slate-600">
        {titulo}
      </span>
      {children}
    </label>
  );
}

function tituloOrigem(tipo: TipoViagem) {
  if (tipo === "Carregado") return "Local de carregamento";
  return "Local de saída";
}

function tituloDestino(tipo: TipoViagem) {
  if (tipo === "Carregado") return "Destino de descarga";
  if (tipo === "Vazio") return "Destino de carregamento";
  return "Destino do deslocamento";
}

function placeholderOrigem(tipo: TipoViagem) {
  if (tipo === "Carregado") return "Ex.: Ibiti";
  if (tipo === "Vazio") return "Ex.: Puma";
  return "Ex.: Base da empresa";
}

function placeholderDestino(
  tipo: TipoViagem,
  motivo: MotivoDeslocamento | ""
) {
  if (tipo === "Carregado") return "Ex.: Puma";
  if (tipo === "Vazio") return "Ex.: Ibiti";
  if (motivo === "Manutenção") return "Ex.: Oficina Mercedes";
  if (motivo === "Retorno para casa")
    return "Ex.: Garagem / residência";
  if (motivo === "Abastecimento")
    return "Ex.: Posto de combustível";
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
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        🔴 O caminhão está carregado e seguirá até o local
        de descarga.
      </div>
    );
  }

  if (tipo === "Vazio") {
    return (
      <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
        🟠 O caminhão está vazio e seguirá para buscar uma
        nova carga.
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
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
  if (tipo === "Carregado") return "bg-red-600";
  if (tipo === "Vazio") return "bg-orange-500";
  return "bg-blue-600";
}