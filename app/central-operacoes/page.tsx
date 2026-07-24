"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import { supabase } from "@/lib/supabase";

type Linha = {
  motorista_id: string;
  nome: string;
  placa: string | null;
  modelo: string | null;
  jornada_ativa: boolean;
  tipo_evento: string | null;
  ocorrido_em: string | null;
  latitude: number | null;
  longitude: number | null;
  capturado_em: string | null;
  velocidade_kmh: number | null;
};

type FiltroStatus = "TODOS" | "EM_OPERACAO" | "AGUARDANDO" | "SEM_GPS" | "INATIVOS";

const EVENTOS: Record<string, { rotulo: string; grupo: "MOVIMENTO" | "PARADO" | "AGUARDANDO" | "OCORRENCIA"; icone: string }> = {
  JORNADA_INICIADA: { rotulo: "Jornada iniciada", grupo: "PARADO", icone: "🟢" },
  SAINDO_PARA_CARREGAMENTO: { rotulo: "Indo para carregamento", grupo: "MOVIMENTO", icone: "🚛" },
  CHEGOU_CARREGAMENTO: { rotulo: "No carregamento", grupo: "AGUARDANDO", icone: "🌲" },
  CARREGADO_SAINDO_DESCARGA: { rotulo: "Carregado — indo para descarga", grupo: "MOVIMENTO", icone: "📦" },
  CHEGOU_DESCARGA: { rotulo: "Na descarga", grupo: "AGUARDANDO", icone: "🏭" },
  DESCARGA_CONCLUIDA: { rotulo: "Descarga concluída", grupo: "PARADO", icone: "✅" },
  AGUARDANDO_DESTINO: { rotulo: "Aguardando destino", grupo: "AGUARDANDO", icone: "⏳" },
  ABASTECIMENTO_INICIADO: { rotulo: "Abastecendo", grupo: "OCORRENCIA", icone: "⛽" },
  ABASTECIMENTO_CONCLUIDO: { rotulo: "Abastecimento concluído", grupo: "PARADO", icone: "✅" },
  DESCANSO_INICIADO: { rotulo: "Em descanso", grupo: "OCORRENCIA", icone: "😴" },
  DESCANSO_FINALIZADO: { rotulo: "Descanso finalizado", grupo: "PARADO", icone: "✅" },
  MANUTENCAO_INICIADA: { rotulo: "Em manutenção", grupo: "OCORRENCIA", icone: "🔧" },
  MANUTENCAO_FINALIZADA: { rotulo: "Manutenção finalizada", grupo: "PARADO", icone: "✅" },
};

function diferencaSegundos(data: string | null, agora: number) {
  if (!data) return null;
  return Math.max(0, Math.floor((agora - new Date(data).getTime()) / 1000));
}

function duracao(data: string | null, agora: number) {
  const total = diferencaSegundos(data, agora);
  if (total == null) return "—";
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  if (horas > 0) return `${horas}h ${String(minutos).padStart(2, "0")}min`;
  if (minutos > 0) return `${minutos}min ${String(segundos).padStart(2, "0")}s`;
  return `${segundos}s`;
}

function horario(data: string | null) {
  if (!data) return "—";
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function situacao(linha: Linha) {
  if (!linha.jornada_ativa) return { rotulo: "Sem jornada ativa", grupo: "PARADO" as const, icone: "⚪" };
  return EVENTOS[linha.tipo_evento ?? ""] ?? { rotulo: "Jornada em andamento", grupo: "PARADO" as const, icone: "🟢" };
}

function statusGps(linha: Linha, agora: number) {
  const segundos = diferencaSegundos(linha.capturado_em, agora);
  if (segundos == null) return { texto: "Sem sinal de GPS", classe: "bg-rose-100 text-rose-800", nivel: "SEM" as const };
  if (segundos <= 60) return { texto: "GPS online", classe: "bg-emerald-100 text-emerald-800", nivel: "ONLINE" as const };
  if (segundos <= 300) return { texto: `GPS há ${duracao(linha.capturado_em, agora)}`, classe: "bg-amber-100 text-amber-800", nivel: "ATRASADO" as const };
  return { texto: `Sem atualização há ${duracao(linha.capturado_em, agora)}`, classe: "bg-rose-100 text-rose-800", nivel: "SEM" as const };
}

export default function CentralOperacoesPage() {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(Date.now());
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("TODOS");

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: perfil } = await supabase.from("perfis").select("tipo,ativo").eq("id", user.id).single();
    if (!perfil || perfil.tipo !== "Administrador" || !perfil.ativo) {
      router.replace("/login");
      return;
    }

    const { data: motoristas, error } = await supabase
      .from("motoristas")
      .select("id,nome,veiculo_id")
      .eq("status", "Ativo")
      .order("nome");

    if (error) {
      setMensagem(error.message);
      setCarregando(false);
      return;
    }

    const ids = (motoristas ?? []).map((motorista) => motorista.id);
    const { data: veiculos } = await supabase.from("veiculos").select("id,placa,modelo");
    const { data: jornadas } = ids.length
      ? await supabase.from("jornadas_motorista").select("id,motorista_id").in("motorista_id", ids).eq("status", "Ativa")
      : { data: [] };

    const jornadasIds = (jornadas ?? []).map((jornada) => jornada.id);
    const { data: eventos } = jornadasIds.length
      ? await supabase
          .from("eventos_operacionais")
          .select("jornada_id,motorista_id,tipo_evento,ocorrido_em")
          .in("jornada_id", jornadasIds)
          .order("ocorrido_em", { ascending: false })
      : { data: [] };

    const { data: gps } = ids.length
      ? await supabase
          .from("localizacoes_gps")
          .select("motorista_id,latitude,longitude,capturado_em,velocidade_kmh")
          .in("motorista_id", ids)
          .order("capturado_em", { ascending: false })
          .limit(Math.max(100, ids.length * 5))
      : { data: [] };

    const jornadaPorMotorista = new Map((jornadas ?? []).map((jornada) => [jornada.motorista_id, jornada.id]));
    const eventoAtual = new Map<string, (typeof eventos extends (infer T)[] | null ? T : never)>();
    for (const evento of eventos ?? []) {
      if (!eventoAtual.has(evento.motorista_id)) eventoAtual.set(evento.motorista_id, evento);
    }

    const gpsAtual = new Map<string, (typeof gps extends (infer T)[] | null ? T : never)>();
    for (const localizacao of gps ?? []) {
      if (!gpsAtual.has(localizacao.motorista_id)) gpsAtual.set(localizacao.motorista_id, localizacao);
    }

    const veiculoPorId = new Map((veiculos ?? []).map((veiculo) => [veiculo.id, veiculo]));

    setLinhas(
      (motoristas ?? []).map((motorista) => {
        const evento = eventoAtual.get(motorista.id);
        const localizacao = gpsAtual.get(motorista.id);
        const veiculo = veiculoPorId.get(motorista.veiculo_id);
        const jornadaAtiva = jornadaPorMotorista.has(motorista.id);

        return {
          motorista_id: motorista.id,
          nome: motorista.nome,
          placa: veiculo?.placa ?? null,
          modelo: veiculo?.modelo ?? null,
          jornada_ativa: jornadaAtiva,
          tipo_evento: jornadaAtiva ? evento?.tipo_evento ?? null : null,
          ocorrido_em: jornadaAtiva ? evento?.ocorrido_em ?? null : null,
          latitude: localizacao?.latitude ?? null,
          longitude: localizacao?.longitude ?? null,
          capturado_em: localizacao?.capturado_em ?? null,
          velocidade_kmh: localizacao?.velocidade_kmh ?? null,
        };
      }),
    );

    setMensagem("");
    setCarregando(false);
  }, [router]);

  useEffect(() => {
    void carregar();
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    const atualizacao = window.setInterval(() => void carregar(), 15000);
    const canal = supabase
      .channel("central-operacoes-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_operacionais" }, () => void carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "jornadas_motorista" }, () => void carregar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "localizacoes_gps" }, () => void carregar())
      .subscribe();

    return () => {
      window.clearInterval(relogio);
      window.clearInterval(atualizacao);
      void supabase.removeChannel(canal);
    };
  }, [carregar]);

  const totais = useMemo(() => {
    const emOperacao = linhas.filter((linha) => linha.jornada_ativa).length;
    const aguardando = linhas.filter((linha) => linha.jornada_ativa && situacao(linha).grupo === "AGUARDANDO").length;
    const gpsOnline = linhas.filter((linha) => linha.jornada_ativa && statusGps(linha, agora).nivel === "ONLINE").length;
    const semGps = linhas.filter((linha) => linha.jornada_ativa && statusGps(linha, agora).nivel === "SEM").length;
    return { emOperacao, aguardando, gpsOnline, semGps };
  }, [linhas, agora]);

  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return linhas
      .filter((linha) => {
        if (termo && !`${linha.nome} ${linha.placa ?? ""} ${linha.modelo ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo)) return false;
        const estadoGps = statusGps(linha, agora);
        const estado = situacao(linha);
        if (filtro === "EM_OPERACAO" && !linha.jornada_ativa) return false;
        if (filtro === "AGUARDANDO" && (!linha.jornada_ativa || estado.grupo !== "AGUARDANDO")) return false;
        if (filtro === "SEM_GPS" && (!linha.jornada_ativa || estadoGps.nivel !== "SEM")) return false;
        if (filtro === "INATIVOS" && linha.jornada_ativa) return false;
        return true;
      })
      .sort((a, b) => Number(b.jornada_ativa) - Number(a.jornada_ativa) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhas, busca, filtro, agora]);

  return (
    <main className="min-h-screen bg-slate-100 pb-24 text-slate-950">
      <header className="bg-slate-950 px-5 py-7 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.3em] text-amber-400">SGF Nobre</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Central de Operações</h1>
            <p className="mt-1 text-slate-400">Situação da frota e dos motoristas em tempo real.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            Atualização automática ativa
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button onClick={() => setFiltro("EM_OPERACAO")} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Em operação</p>
            <p className="mt-2 text-3xl font-black text-emerald-600">{totais.emOperacao}</p>
          </button>
          <button onClick={() => setFiltro("AGUARDANDO")} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Aguardando</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{totais.aguardando}</p>
          </button>
          <button onClick={() => setFiltro("TODOS")} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">GPS online</p>
            <p className="mt-2 text-3xl font-black text-sky-600">{totais.gpsOnline}</p>
          </button>
          <button onClick={() => setFiltro("SEM_GPS")} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sem sinal GPS</p>
            <p className="mt-2 text-3xl font-black text-rose-600">{totais.semGps}</p>
          </button>
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm md:flex-row">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar motorista, placa ou modelo..."
            className="min-h-12 flex-1 rounded-xl border border-slate-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as FiltroStatus)}
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-amber-500"
          >
            <option value="TODOS">Todos os motoristas</option>
            <option value="EM_OPERACAO">Somente em operação</option>
            <option value="AGUARDANDO">Somente aguardando</option>
            <option value="SEM_GPS">Somente sem GPS</option>
            <option value="INATIVOS">Sem jornada ativa</option>
          </select>
          <button onClick={() => void carregar()} className="min-h-12 rounded-xl bg-slate-950 px-5 font-bold text-white hover:bg-slate-800">
            Atualizar agora
          </button>
        </section>

        {mensagem && <div className="mt-4 rounded-xl bg-red-100 p-4 font-medium text-red-800">{mensagem}</div>}

        {carregando ? (
          <div className="mt-5 rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">Carregando operação...</div>
        ) : linhasFiltradas.length === 0 ? (
          <div className="mt-5 rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-black">Nenhum motorista encontrado</p>
            <p className="mt-1 text-slate-500">Altere o filtro ou a busca para visualizar outros registros.</p>
          </div>
        ) : (
          <section className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {linhasFiltradas.map((linha) => {
              const estado = situacao(linha);
              const gps = statusGps(linha, agora);
              const emMovimento = estado.grupo === "MOVIMENTO";
              return (
                <article key={linha.motorista_id} className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${linha.jornada_ativa ? "ring-slate-200" : "ring-slate-100 opacity-80"}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-black">{linha.nome}</h2>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {linha.placa ?? "Sem veículo vinculado"}{linha.modelo ? ` • ${linha.modelo}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${linha.jornada_ativa ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                        {linha.jornada_ativa ? "EM OPERAÇÃO" : "INATIVO"}
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl" aria-hidden>{estado.icone}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Situação atual</p>
                          <p className="mt-1 text-lg font-black text-amber-400">{estado.rotulo}</p>
                          <p className="mt-2 text-sm text-slate-300">
                            {linha.jornada_ativa ? `Desde ${horario(linha.ocorrido_em)} • ${duracao(linha.ocorrido_em, agora)}` : "Motorista fora de jornada"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Velocidade</p>
                        <p className={`mt-1 text-lg font-black ${emMovimento ? "text-sky-700" : "text-slate-900"}`}>
                          {linha.velocidade_kmh == null ? "—" : `${Math.max(0, Math.round(linha.velocidade_kmh))} km/h`}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Início da etapa</p>
                        <p className="mt-1 text-lg font-black">{horario(linha.ocorrido_em)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rastreamento</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {linha.capturado_em ? `Última posição às ${horario(linha.capturado_em)}` : "Nenhuma posição recebida"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${gps.classe}`}>{gps.texto}</span>
                    </div>

                    {linha.latitude != null && linha.longitude != null ? (
                      <a
                        className="mt-4 block rounded-xl bg-amber-400 px-4 py-3 text-center font-black text-slate-950 transition hover:bg-amber-300"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps?q=${linha.latitude},${linha.longitude}`}
                      >
                        Ver localização no mapa
                      </a>
                    ) : (
                      <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">Localização ainda não disponível</div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
      <MobileNav />
    </main>
  );
}
