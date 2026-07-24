"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EventoTipo =
  | "JORNADA_INICIADA" | "SAINDO_PARA_CARREGAMENTO" | "CHEGOU_CARREGAMENTO"
  | "CARREGADO_SAINDO_DESCARGA" | "CHEGOU_DESCARGA" | "DESCARGA_CONCLUIDA"
  | "AGUARDANDO_DESTINO" | "ABASTECIMENTO_INICIADO" | "ABASTECIMENTO_CONCLUIDO"
  | "DESCANSO_INICIADO" | "DESCANSO_FINALIZADO" | "MANUTENCAO_INICIADA"
  | "MANUTENCAO_FINALIZADA" | "JORNADA_ENCERRADA";

type Evento = { id:string; tipo_evento:EventoTipo; ocorrido_em:string; latitude:number|null; longitude:number|null };
type Perfil = { nome:string; tipo:string; ativo:boolean; motorista_id:string|null };
type Motorista = { id:string; nome:string; veiculo_id:string|null };
type Jornada = { id:string; motorista_id:string; veiculo_id:string|null; iniciada_em:string; status:string };

const rotulos: Record<EventoTipo,string> = {
  JORNADA_INICIADA:"Jornada iniciada", SAINDO_PARA_CARREGAMENTO:"Saindo para carregamento",
  CHEGOU_CARREGAMENTO:"Chegou ao carregamento", CARREGADO_SAINDO_DESCARGA:"Carregado — saindo para descarga",
  CHEGOU_DESCARGA:"Chegou à descarga", DESCARGA_CONCLUIDA:"Descarga concluída",
  AGUARDANDO_DESTINO:"Aguardando destino", ABASTECIMENTO_INICIADO:"Iniciou abastecimento",
  ABASTECIMENTO_CONCLUIDO:"Abastecimento concluído", DESCANSO_INICIADO:"Iniciou descanso",
  DESCANSO_FINALIZADO:"Fim do descanso", MANUTENCAO_INICIADA:"Iniciou manutenção",
  MANUTENCAO_FINALIZADA:"Manutenção finalizada", JORNADA_ENCERRADA:"Jornada encerrada"
};
const proximos: Partial<Record<EventoTipo,EventoTipo[]>> = {
  JORNADA_INICIADA:["SAINDO_PARA_CARREGAMENTO","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","MANUTENCAO_INICIADA","JORNADA_ENCERRADA"],
  SAINDO_PARA_CARREGAMENTO:["CHEGOU_CARREGAMENTO","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","MANUTENCAO_INICIADA"],
  CHEGOU_CARREGAMENTO:["CARREGADO_SAINDO_DESCARGA"],
  CARREGADO_SAINDO_DESCARGA:["CHEGOU_DESCARGA","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","MANUTENCAO_INICIADA"],
  CHEGOU_DESCARGA:["DESCARGA_CONCLUIDA"],
  DESCARGA_CONCLUIDA:["SAINDO_PARA_CARREGAMENTO","AGUARDANDO_DESTINO","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","MANUTENCAO_INICIADA","JORNADA_ENCERRADA"],
  AGUARDANDO_DESTINO:["SAINDO_PARA_CARREGAMENTO","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","MANUTENCAO_INICIADA","JORNADA_ENCERRADA"],
  ABASTECIMENTO_INICIADO:["ABASTECIMENTO_CONCLUIDO"],
  ABASTECIMENTO_CONCLUIDO:["SAINDO_PARA_CARREGAMENTO","DESCANSO_INICIADO","MANUTENCAO_INICIADA","JORNADA_ENCERRADA"],
  DESCANSO_INICIADO:["DESCANSO_FINALIZADO"], DESCANSO_FINALIZADO:["SAINDO_PARA_CARREGAMENTO","ABASTECIMENTO_INICIADO","MANUTENCAO_INICIADA","JORNADA_ENCERRADA"],
  MANUTENCAO_INICIADA:["MANUTENCAO_FINALIZADA"], MANUTENCAO_FINALIZADA:["SAINDO_PARA_CARREGAMENTO","ABASTECIMENTO_INICIADO","DESCANSO_INICIADO","JORNADA_ENCERRADA"]
};
function duracao(inicio:string, agora:number){ const s=Math.max(0,Math.floor((agora-new Date(inicio).getTime())/1000)); return `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function hora(v:string){ return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(v)); }

export default function MotoristaPage(){
 const router=useRouter(); const [perfil,setPerfil]=useState<Perfil|null>(null); const [motorista,setMotorista]=useState<Motorista|null>(null);
 const [jornada,setJornada]=useState<Jornada|null>(null); const [eventos,setEventos]=useState<Evento[]>([]); const [msg,setMsg]=useState("");
 const [loading,setLoading]=useState(true); const [salvando,setSalvando]=useState(false); const [gps,setGps]=useState(false); const [agora,setAgora]=useState(Date.now()); const watchRef=useRef<number|null>(null);
 const ultimo=eventos[0]??null; const botoes=ultimo ? (proximos[ultimo.tipo_evento]??[]) : [];
 const carregar=useCallback(async()=>{
   const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/login");return;}
   const {data:p,error:pe}=await supabase.from("perfis").select("nome,tipo,ativo,motorista_id").eq("id",user.id).single();
   if(pe||!p||p.tipo!=="Motorista"||!p.ativo){setMsg("Acesso de motorista não encontrado ou desativado.");setLoading(false);return;}
   setPerfil(p as Perfil); let mid=p.motorista_id as string|null;
   if(!mid){const {data:m}=await supabase.from("motoristas").select("id,nome,veiculo_id").eq("auth_user_id",user.id).maybeSingle(); if(m){mid=m.id;setMotorista(m as Motorista);}}
   else {const {data:m}=await supabase.from("motoristas").select("id,nome,veiculo_id").eq("id",mid).single(); if(m)setMotorista(m as Motorista);}
   if(!mid){setMsg("Seu usuário ainda não está vinculado ao cadastro de motorista.");setLoading(false);return;}
   const {data:j}=await supabase.from("jornadas_motorista").select("*").eq("motorista_id",mid).eq("status","Ativa").maybeSingle(); setJornada(j as Jornada|null);
   if(j){const {data:e}=await supabase.from("eventos_operacionais").select("id,tipo_evento,ocorrido_em,latitude,longitude").eq("jornada_id",j.id).order("ocorrido_em",{ascending:false});setEventos((e??[]) as Evento[]);} else setEventos([]);
   setLoading(false);
 },[router]);
 useEffect(()=>{void carregar(); const t=setInterval(()=>setAgora(Date.now()),1000); return()=>clearInterval(t);},[carregar]);
 useEffect(()=>{if(!motorista)return; const c=supabase.channel(`motorista-${motorista.id}`).on("postgres_changes",{event:"*",schema:"public",table:"eventos_operacionais",filter:`motorista_id=eq.${motorista.id}`},()=>void carregar()).subscribe(); return()=>{void supabase.removeChannel(c)};},[motorista,carregar]);
 useEffect(()=>()=>{if(watchRef.current!==null)navigator.geolocation?.clearWatch(watchRef.current);},[]);
 useEffect(()=>{if(!jornada&&watchRef.current!==null){navigator.geolocation?.clearWatch(watchRef.current);watchRef.current=null;setGps(false);}},[jornada]);
 const obterPosicao=()=>new Promise<GeolocationPosition|null>((resolve)=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{enableHighAccuracy:true,timeout:10000,maximumAge:15000});});
 async function registrar(tipo:EventoTipo){setSalvando(true);setMsg("");const p=await obterPosicao();const {error}=await supabase.rpc("registrar_evento_operacional",{p_tipo_evento:tipo,p_latitude:p?.coords.latitude??null,p_longitude:p?.coords.longitude??null,p_precisao_metros:p?.coords.accuracy??null,p_observacao:null});if(error)setMsg(error.message);else await carregar();setSalvando(false);}
 function iniciarGps(){if(watchRef.current!==null)return;if(!motorista||!navigator.geolocation){setMsg("GPS não disponível neste aparelho.");return;} watchRef.current=navigator.geolocation.watchPosition(async p=>{setGps(true);await supabase.from("localizacoes_gps").insert({motorista_id:motorista.id,veiculo_id:motorista.veiculo_id,jornada_id:jornada?.id??null,latitude:p.coords.latitude,longitude:p.coords.longitude,precisao_metros:p.coords.accuracy,velocidade_kmh:p.coords.speed==null?null:p.coords.speed*3.6,direcao_graus:p.coords.heading,altitude_metros:p.coords.altitude,capturado_em:new Date(p.timestamp).toISOString()});},()=>{setGps(false);setMsg("Não foi possível manter o GPS ativo. Confira a permissão de localização.");},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});}
 function pararGps(){if(watchRef.current!==null)navigator.geolocation.clearWatch(watchRef.current);watchRef.current=null;setGps(false);}
 async function sair(){pararGps();await supabase.auth.signOut();router.replace("/login");}
 if(loading)return <main className="min-h-screen bg-slate-950 p-6 text-white">Carregando operação...</main>;
 return <main className="min-h-screen bg-slate-950 pb-10 text-white"><header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur"><div className="mx-auto flex max-w-xl items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.3em] text-amber-400">SGF Nobre</p><h1 className="text-xl font-bold">Área do motorista</h1></div><button onClick={sair} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">Sair</button></div></header>
 <div className="mx-auto max-w-xl space-y-4 p-4"><section className="rounded-3xl bg-white p-5 text-slate-950 shadow-xl"><p className="text-sm text-slate-500">Olá,</p><h2 className="text-2xl font-black">{motorista?.nome??perfil?.nome}</h2>
 {!jornada?<div className="mt-6"><p className="text-sm text-slate-600">Nenhuma jornada ativa.</p><button disabled={salvando} onClick={()=>registrar("JORNADA_INICIADA")} className="mt-4 w-full rounded-2xl bg-amber-400 px-5 py-4 text-lg font-black">Iniciar jornada</button></div>:
 <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs uppercase tracking-widest text-slate-400">Status atual</p><h3 className="mt-2 text-xl font-black text-amber-400">{ultimo?rotulos[ultimo.tipo_evento]:"Jornada ativa"}</h3><p className="mt-3 font-mono text-4xl font-bold">{ultimo?duracao(ultimo.ocorrido_em,agora):"00:00:00"}</p><p className="mt-1 text-xs text-slate-400">Iniciado às {ultimo?hora(ultimo.ocorrido_em):hora(jornada.iniciada_em)}</p></div>}
 </section>
 {jornada&&<section className="rounded-3xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">Rastreamento pelo celular</h3><p className="text-xs text-slate-400">Envia sua posição durante a jornada.</p></div><button onClick={gps?pararGps:iniciarGps} className={`rounded-xl px-4 py-3 font-bold ${gps?"bg-emerald-500 text-slate-950":"bg-slate-700"}`}>{gps?"GPS ativo":"Ativar GPS"}</button></div></section>}
 {msg&&<div className="rounded-2xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-200">{msg}</div>}
 {jornada&&<section className="grid gap-3">{botoes.map(t=><button key={t} disabled={salvando} onClick={()=>registrar(t)} className={`rounded-2xl px-5 py-5 text-left text-lg font-black shadow-lg disabled:opacity-50 ${t==="JORNADA_ENCERRADA"?"bg-red-600":"bg-amber-400 text-slate-950"}`}>{rotulos[t]}</button>)}</section>}
 {eventos.length>0&&<section className="rounded-3xl bg-white p-5 text-slate-950"><h3 className="text-lg font-black">Linha do tempo de hoje</h3><div className="mt-4 space-y-4">{eventos.map((e,i)=><div key={e.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="mt-1 h-3 w-3 rounded-full bg-amber-400"/>{i<eventos.length-1&&<span className="h-full w-px bg-slate-200"/>}</div><div className="pb-3"><p className="font-bold">{rotulos[e.tipo_evento]}</p><p className="text-sm text-slate-500">{hora(e.ocorrido_em)}{e.latitude!=null?" • localização registrada":""}</p></div></div>)}</div></section>}
 </div></main>;
}
