"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EventoTipo =
  | "JORNADA_INICIADA"
  | "SAINDO_PARA_CARREGAMENTO"
  | "CHEGOU_CARREGAMENTO"
  | "CARREGADO_SAINDO_DESCARGA"
  | "CHEGOU_DESCARGA"
  | "DESCARGA_CONCLUIDA"
  | "AGUARDANDO_DESTINO"
  | "ABASTECIMENTO_INICIADO"
  | "ABASTECIMENTO_CONCLUIDO"
  | "DESCANSO_INICIADO"
  | "DESCANSO_FINALIZADO"
  | "MANUTENCAO_INICIADA"
  | "MANUTENCAO_FINALIZADA"
  | "JORNADA_ENCERRADA";

type Evento = {
  id: string;
  tipo_evento: EventoTipo;
  ocorrido_em: string;
  latitude: number | null;
  longitude: number | null;
};

type Perfil = {
  nome: string;
  tipo: string;
  ativo: boolean;
  motorista_id: string | null;
};

type Motorista = {
  id: string;
  nome: string;
  veiculo_id: string | null;
};

type Jornada = {
  id: string;
  motorista_id: string;
  veiculo_id: string | null;
  iniciada_em: string;
  status: string;
};

const rotulos: Record<EventoTipo, string> = {
  JORNADA_INICIADA: "Jornada iniciada",
  SAINDO_PARA_CARREGAMENTO: "Saindo para carregamento",
  CHEGOU_CARREGAMENTO: "Chegou ao carregamento",
  CARREGADO_SAINDO_DESCARGA: "Carregado — saindo para descarga",
  CHEGOU_DESCARGA: "Chegou à descarga",
  DESCARGA_CONCLUIDA: "Descarga concluída",
  AGUARDANDO_DESTINO: "Aguardando destino",
  ABASTECIMENTO_INICIADO: "Iniciou abastecimento",
  ABASTECIMENTO_CONCLUIDO: "Abastecimento concluído",
  DESCANSO_INICIADO: "Iniciou descanso",
  DESCANSO_FINALIZADO: "Fim do descanso",
  MANUTENCAO_INICIADA: "Iniciou manutenção",
  MANUTENCAO_FINALIZADA: "Manutenção finalizada",
  JORNADA_ENCERRADA: "Jornada encerrada",
};

const proximos: Partial<Record<EventoTipo, EventoTipo[]>> = {
  JORNADA_INICIADA: [
    "SAINDO_PARA_CARREGAMENTO",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
    "JORNADA_ENCERRADA",
  ],
  SAINDO_PARA_CARREGAMENTO: [
    "CHEGOU_CARREGAMENTO",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
  ],
  CHEGOU_CARREGAMENTO: ["CARREGADO_SAINDO_DESCARGA"],
  CARREGADO_SAINDO_DESCARGA: [
    "CHEGOU_DESCARGA",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
  ],
  CHEGOU_DESCARGA: ["DESCARGA_CONCLUIDA"],
  DESCARGA_CONCLUIDA: [
    "SAINDO_PARA_CARREGAMENTO",
    "AGUARDANDO_DESTINO",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
    "JORNADA_ENCERRADA",
  ],
  AGUARDANDO_DESTINO: [
    "SAINDO_PARA_CARREGAMENTO",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
    "JORNADA_ENCERRADA",
  ],
  ABASTECIMENTO_INICIADO: ["ABASTECIMENTO_CONCLUIDO"],
  ABASTECIMENTO_CONCLUIDO: [
    "SAINDO_PARA_CARREGAMENTO",
    "DESCANSO_INICIADO",
    "MANUTENCAO_INICIADA",
    "JORNADA_ENCERRADA",
  ],
  DESCANSO_INICIADO: ["DESCANSO_FINALIZADO"],
  DESCANSO_FINALIZADO: [
    "SAINDO_PARA_CARREGAMENTO",
    "ABASTECIMENTO_INICIADO",
    "MANUTENCAO_INICIADA",
    "JORNADA_ENCERRADA",
  ],
  MANUTENCAO_INICIADA: ["MANUTENCAO_FINALIZADA"],
  MANUTENCAO_FINALIZADA: [
    "SAINDO_PARA_CARREGAMENTO",
    "ABASTECIMENTO_INICIADO",
    "DESCANSO_INICIADO",
    "JORNADA_ENCERRADA",
  ],
};

const principaisPorEtapa: Partial<Record<EventoTipo, EventoTipo[]>> = {
  JORNADA_INICIADA: ["SAINDO_PARA_CARREGAMENTO"],
  SAINDO_PARA_CARREGAMENTO: ["CHEGOU_CARREGAMENTO"],
  CHEGOU_CARREGAMENTO: ["CARREGADO_SAINDO_DESCARGA"],
  CARREGADO_SAINDO_DESCARGA: ["CHEGOU_DESCARGA"],
  CHEGOU_DESCARGA: ["DESCARGA_CONCLUIDA"],
  DESCARGA_CONCLUIDA: [
    "AGUARDANDO_DESTINO",
    "SAINDO_PARA_CARREGAMENTO",
  ],
  AGUARDANDO_DESTINO: ["SAINDO_PARA_CARREGAMENTO"],
  ABASTECIMENTO_INICIADO: ["ABASTECIMENTO_CONCLUIDO"],
  ABASTECIMENTO_CONCLUIDO: ["SAINDO_PARA_CARREGAMENTO"],
  DESCANSO_INICIADO: ["DESCANSO_FINALIZADO"],
  DESCANSO_FINALIZADO: ["SAINDO_PARA_CARREGAMENTO"],
  MANUTENCAO_INICIADA: ["MANUTENCAO_FINALIZADA"],
  MANUTENCAO_FINALIZADA: ["SAINDO_PARA_CARREGAMENTO"],
};

function duracao(inicio: string, agora: number) {
  const segundos = Math.max(
    0,
    Math.floor((agora - new Date(inicio).getTime()) / 1000),
  );

  return `${String(Math.floor(segundos / 3600)).padStart(2, "0")}:${String(
    Math.floor((segundos % 3600) / 60),
  ).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
}

function hora(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(valor));
}

export default function MotoristaPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [gps, setGps] = useState(false);
  const [gpsIniciando, setGpsIniciando] = useState(false);
  const [agora, setAgora] = useState(Date.now());

  const watchRef = useRef<number | null>(null);

  const ultimo = eventos[0] ?? null;
  const botoes = ultimo ? (proximos[ultimo.tipo_evento] ?? []) : [];
  const principais = ultimo
    ? (principaisPorEtapa[ultimo.tipo_evento] ?? [])
    : [];
  const secundarios = botoes.filter((tipo) => !principais.includes(tipo));

  const carregar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: perfilEncontrado, error: erroPerfil } = await supabase
      .from("perfis")
      .select("nome,tipo,ativo,motorista_id")
      .eq("id", user.id)
      .single();

    if (
      erroPerfil ||
      !perfilEncontrado ||
      perfilEncontrado.tipo !== "Motorista" ||
      !perfilEncontrado.ativo
    ) {
      setMsg("Acesso de motorista não encontrado ou desativado.");
      setLoading(false);
      return;
    }

    setPerfil(perfilEncontrado as Perfil);

    let motoristaId = perfilEncontrado.motorista_id as string | null;

    if (!motoristaId) {
      const { data: motoristaEncontrado } = await supabase
        .from("motoristas")
        .select("id,nome,veiculo_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (motoristaEncontrado) {
        motoristaId = motoristaEncontrado.id;
        setMotorista(motoristaEncontrado as Motorista);
      }
    } else {
      const { data: motoristaEncontrado } = await supabase
        .from("motoristas")
        .select("id,nome,veiculo_id")
        .eq("id", motoristaId)
        .maybeSingle();

      if (motoristaEncontrado) {
        setMotorista(motoristaEncontrado as Motorista);
      }
    }

    if (!motoristaId) {
      setMsg("Seu usuário ainda não está vinculado ao cadastro de motorista.");
      setLoading(false);
      return;
    }

    const { data: jornadaAtiva, error: erroJornada } = await supabase
      .from("jornadas_motorista")
      .select("*")
      .eq("motorista_id", motoristaId)
      .eq("status", "Ativa")
      .maybeSingle();

    if (erroJornada) {
      setMsg(`Erro ao carregar jornada: ${erroJornada.message}`);
      setLoading(false);
      return;
    }

    setJornada(jornadaAtiva as Jornada | null);

    if (jornadaAtiva) {
      const { data: eventosEncontrados, error: erroEventos } = await supabase
        .from("eventos_operacionais")
        .select("id,tipo_evento,ocorrido_em,latitude,longitude")
        .eq("jornada_id", jornadaAtiva.id)
        .order("ocorrido_em", { ascending: false });

      if (erroEventos) {
        setMsg(`Erro ao carregar eventos: ${erroEventos.message}`);
      }

      setEventos((eventosEncontrados ?? []) as Evento[]);
    } else {
      setEventos([]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void carregar();

    const intervalo = window.setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [carregar]);

  useEffect(() => {
    if (!motorista) return;

    const canal = supabase
      .channel(`motorista-${motorista.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "eventos_operacionais",
          filter: `motorista_id=eq.${motorista.id}`,
        },
        () => void carregar(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [motorista, carregar]);

  useEffect(() => {
    return () => {
      if (
        watchRef.current !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !jornada &&
      watchRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setGps(false);
    }
  }, [jornada]);

  const obterPosicao = () =>
    new Promise<GeolocationPosition | null>((resolve) => {
      if (
        typeof navigator === "undefined" ||
        !navigator.geolocation
      ) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 15000,
        },
      );
    });

  async function registrar(tipo: EventoTipo) {
    setSalvando(true);
    setMsg("");

    const posicao = await obterPosicao();

    const { error } = await supabase.rpc("registrar_evento_operacional", {
      p_tipo_evento: tipo,
      p_latitude: posicao?.coords.latitude ?? null,
      p_longitude: posicao?.coords.longitude ?? null,
      p_precisao_metros: posicao?.coords.accuracy ?? null,
      p_observacao: null,
    });

    if (error) {
      setMsg(error.message);
    } else {
      await carregar();
    }

    setSalvando(false);
  }

  /*
   * CORREÇÃO PRINCIPAL:
   * A localização passa a usar os identificadores da própria jornada ativa.
   * Assim, o GPS não depende do objeto "motorista" estar disponível na tela.
   *
   * Isso resolve o caso em que a jornada e os eventos carregam normalmente,
   * mas a consulta direta à tabela "motoristas" é bloqueada ou retorna vazia
   * por uma política RLS.
   */
  async function salvarPosicao(posicao: GeolocationPosition) {
    if (!jornada) {
      throw new Error("Nenhuma jornada ativa foi encontrada.");
    }

    const { error } = await supabase.from("localizacoes_gps").insert({
      motorista_id: jornada.motorista_id,
      veiculo_id: jornada.veiculo_id ?? motorista?.veiculo_id ?? null,
      jornada_id: jornada.id,
      latitude: posicao.coords.latitude,
      longitude: posicao.coords.longitude,
      precisao_metros: posicao.coords.accuracy,
      velocidade_kmh:
        posicao.coords.speed == null ? null : posicao.coords.speed * 3.6,
      direcao_graus: posicao.coords.heading,
      altitude_metros: posicao.coords.altitude,
      capturado_em: new Date(posicao.timestamp).toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  function mensagemGps(error: GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
      return "Permissão de localização negada. Libere a localização para este site nas configurações do navegador.";
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      return "O celular não conseguiu determinar sua localização agora. Vá para um local com melhor sinal e tente novamente.";
    }

    if (error.code === error.TIMEOUT) {
      return "O GPS demorou para responder. Tente novamente em alguns segundos.";
    }

    return `Falha ao acessar o GPS: ${
      error.message || "erro desconhecido"
    }.`;
  }

  async function iniciarGps() {
    if (watchRef.current !== null || gpsIniciando) return;

    setMsg("");

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setMsg(
        "Este navegador não oferece suporte à localização. Abra o SGF no Safari ou Chrome atualizado.",
      );
      return;
    }

    /*
     * Agora o GPS depende somente de existir uma jornada ativa.
     * Não depende mais do objeto "motorista", que era a causa da mensagem
     * incorreta de dados ainda carregando.
     */
    if (!jornada) {
      setMsg(
        "Nenhuma jornada ativa foi encontrada. Atualize a página ou inicie uma jornada antes de ligar o GPS.",
      );
      return;
    }

    setGpsIniciando(true);

    navigator.geolocation.getCurrentPosition(
      async (posicaoInicial) => {
        try {
          await salvarPosicao(posicaoInicial);

          setGps(true);
          setMsg("");

          watchRef.current = navigator.geolocation.watchPosition(
            async (novaPosicao) => {
              try {
                await salvarPosicao(novaPosicao);
                setGps(true);
                setMsg("");
              } catch (error) {
                setMsg(
                  error instanceof Error
                    ? `GPS obtido, mas não foi possível salvar: ${error.message}`
                    : "GPS obtido, mas não foi possível salvar a posição.",
                );
              }
            },
            (error) => {
              setGps(false);
              setMsg(mensagemGps(error));
            },
            {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 30000,
            },
          );
        } catch (error) {
          setGps(false);

          setMsg(
            error instanceof Error
              ? `Localização obtida, mas não foi possível salvar: ${error.message}`
              : "Localização obtida, mas não foi possível salvar.",
          );
        } finally {
          setGpsIniciando(false);
        }
      },
      (error) => {
        setGps(false);
        setGpsIniciando(false);
        setMsg(mensagemGps(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 30000,
      },
    );
  }

  function pararGps() {
    if (
      watchRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchRef.current);
    }

    watchRef.current = null;
    setGps(false);
  }

  async function sair() {
    pararGps();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        Carregando operação...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-10 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.3em] text-amber-400">
              SGF Nobre
            </p>
            <h1 className="text-xl font-bold">Área do motorista</h1>
          </div>

          <button
            onClick={sair}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4">
        <section className="rounded-3xl bg-white p-5 text-slate-950 shadow-xl">
          <p className="text-sm text-slate-500">Olá,</p>
          <h2 className="text-2xl font-black">
            {motorista?.nome ?? perfil?.nome}
          </h2>

          {!jornada ? (
            <div className="mt-6">
              <p className="text-sm text-slate-600">
                Nenhuma jornada ativa.
              </p>

              <button
                disabled={salvando}
                onClick={() => registrar("JORNADA_INICIADA")}
                className="mt-4 w-full rounded-2xl bg-amber-400 px-5 py-4 text-lg font-black disabled:opacity-50"
              >
                Iniciar jornada
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Status atual
              </p>

              <h3 className="mt-2 text-xl font-black text-amber-400">
                {ultimo ? rotulos[ultimo.tipo_evento] : "Jornada ativa"}
              </h3>

              <p className="mt-3 font-mono text-4xl font-bold">
                {ultimo
                  ? duracao(ultimo.ocorrido_em, agora)
                  : "00:00:00"}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Iniciado às{" "}
                {ultimo ? hora(ultimo.ocorrido_em) : hora(jornada.iniciada_em)}
              </p>
            </div>
          )}
        </section>

        {jornada && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold">Rastreamento pelo celular</h3>
                <p className="text-xs text-slate-400">
                  Envia sua posição durante a jornada.
                </p>
              </div>

              <button
                disabled={gpsIniciando}
                onClick={gps ? pararGps : () => void iniciarGps()}
                className={`rounded-xl px-4 py-3 font-bold disabled:opacity-60 ${
                  gps
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-700"
                }`}
              >
                {gps
                  ? "GPS ativo"
                  : gpsIniciando
                    ? "Localizando..."
                    : "Ativar GPS"}
              </button>
            </div>
          </section>
        )}

        {msg && (
          <div className="rounded-2xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-200">
            {msg}
          </div>
        )}

        {jornada && (
          <section className="space-y-3">
            <p className="px-1 text-xs font-bold uppercase tracking-[.2em] text-slate-400">
              Próxima ação
            </p>

            <div className="grid gap-3">
              {principais.map((tipo) => (
                <button
                  key={tipo}
                  disabled={salvando}
                  onClick={() => registrar(tipo)}
                  className="rounded-2xl bg-amber-400 px-5 py-5 text-left text-lg font-black text-slate-950 shadow-lg disabled:opacity-50"
                >
                  {rotulos[tipo]}
                </button>
              ))}
            </div>

            {secundarios.length > 0 && (
              <details className="rounded-2xl border border-slate-800 bg-slate-900">
                <summary className="cursor-pointer list-none px-5 py-4 font-bold text-slate-200">
                  Outras ocorrências
                </summary>

                <div className="grid gap-3 border-t border-slate-800 p-3">
                  {secundarios.map((tipo) => (
                    <button
                      key={tipo}
                      disabled={salvando}
                      onClick={() => registrar(tipo)}
                      className={`rounded-xl px-4 py-4 text-left font-bold disabled:opacity-50 ${
                        tipo === "JORNADA_ENCERRADA"
                          ? "bg-red-600 text-white"
                          : "bg-slate-800 text-white"
                      }`}
                    >
                      {rotulos[tipo]}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </section>
        )}

        {eventos.length > 0 && (
          <section className="rounded-3xl bg-white p-5 text-slate-950">
            <h3 className="text-lg font-black">Linha do tempo de hoje</h3>

            <div className="mt-4 space-y-4">
              {eventos.map((evento, indice) => (
                <div key={evento.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-3 w-3 rounded-full bg-amber-400" />
                    {indice < eventos.length - 1 && (
                      <span className="h-full w-px bg-slate-200" />
                    )}
                  </div>

                  <div className="pb-3">
                    <p className="font-bold">
                      {rotulos[evento.tipo_evento]}
                    </p>

                    <p className="text-sm text-slate-500">
                      {hora(evento.ocorrido_em)}
                      {evento.latitude != null
                        ? " • localização registrada"
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
