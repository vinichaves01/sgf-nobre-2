"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import MobileNav from "@/components/MobileNav";
import { supabase } from "@/lib/supabase";

type Linha={motorista_id:string;nome:string;placa:string|null;modelo:string|null;jornada_ativa:boolean;tipo_evento:string|null;ocorrido_em:string|null;latitude:number|null;longitude:number|null;capturado_em:string|null;velocidade_kmh:number|null};
const rotulo=(v:string|null)=>({JORNADA_INICIADA:"Jornada iniciada",SAINDO_PARA_CARREGAMENTO:"Indo para carregamento",CHEGOU_CARREGAMENTO:"No carregamento",CARREGADO_SAINDO_DESCARGA:"Carregado — indo para descarga",CHEGOU_DESCARGA:"Na descarga",DESCARGA_CONCLUIDA:"Descarga concluída",AGUARDANDO_DESTINO:"Aguardando destino",ABASTECIMENTO_INICIADO:"Abastecendo",ABASTECIMENTO_CONCLUIDO:"Abastecimento concluído",DESCANSO_INICIADO:"Em descanso",DESCANSO_FINALIZADO:"Descanso finalizado",MANUTENCAO_INICIADA:"Em manutenção",MANUTENCAO_FINALIZADA:"Manutenção finalizada"}[v??""]??"Sem jornada ativa");
function tempo(v:string|null){if(!v)return"—";const s=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/1000));return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}min`;}
export default function Central(){const router=useRouter();const [linhas,setLinhas]=useState<Linha[]>([]);const [msg,setMsg]=useState("");const [agora,setAgora]=useState(Date.now());
 const carregar=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){router.replace("/login");return;}
  const {data:p}=await supabase.from("perfis").select("tipo,ativo").eq("id",user.id).single();
  if(!p||p.tipo!=="Administrador"||!p.ativo){router.replace("/login");return;}

  const {data:ms,error}=await supabase.from("motoristas").select("id,nome,veiculo_id").eq("status","Ativo").order("nome");
  if(error){setMsg(error.message);return;}
  const ids=(ms??[]).map(m=>m.id);
  const {data:vs}=await supabase.from("veiculos").select("id,placa,modelo");
  const {data:js}=ids.length?await supabase.from("jornadas_motorista").select("id,motorista_id").in("motorista_id",ids).eq("status","Ativa"):{data:[]};
  const jornadasPorMotorista=new Map((js??[]).map(j=>[j.motorista_id,j.id]));
  const jornadasIds=(js??[]).map(j=>j.id);
  const {data:ev}=jornadasIds.length?await supabase.from("eventos_operacionais").select("jornada_id,motorista_id,tipo_evento,ocorrido_em").in("jornada_id",jornadasIds).order("ocorrido_em",{ascending:false}):{data:[]};
  const {data:gps}=ids.length?await supabase.from("localizacoes_gps").select("motorista_id,latitude,longitude,capturado_em,velocidade_kmh").in("motorista_id",ids).order("capturado_em",{ascending:false}).limit(Math.max(100,ids.length*5)):{data:[]};
  const primeiroEvento=new Map();for(const e of ev??[])if(!primeiroEvento.has(e.motorista_id))primeiroEvento.set(e.motorista_id,e);
  const primeiroGps=new Map();for(const g of gps??[])if(!primeiroGps.has(g.motorista_id))primeiroGps.set(g.motorista_id,g);
  const vmap=new Map((vs??[]).map(v=>[v.id,v]));
  setLinhas((ms??[]).map(m=>{const e=primeiroEvento.get(m.id);const g=primeiroGps.get(m.id);const v=vmap.get(m.veiculo_id);const ativa=jornadasPorMotorista.has(m.id);return{motorista_id:m.id,nome:m.nome,placa:v?.placa??null,modelo:v?.modelo??null,jornada_ativa:ativa,tipo_evento:ativa?(e?.tipo_evento??null):null,ocorrido_em:ativa?(e?.ocorrido_em??null):null,latitude:g?.latitude??null,longitude:g?.longitude??null,capturado_em:g?.capturado_em??null,velocidade_kmh:g?.velocidade_kmh??null}}));
  setMsg("");
 },[router]);
 useEffect(()=>{void carregar();const t=setInterval(()=>{setAgora(Date.now());void carregar()},15000);const c=supabase.channel("central-operacoes").on("postgres_changes",{event:"*",schema:"public",table:"eventos_operacionais"},()=>void carregar()).on("postgres_changes",{event:"INSERT",schema:"public",table:"localizacoes_gps"},()=>void carregar()).subscribe();return()=>{clearInterval(t);void supabase.removeChannel(c)}},[carregar]);
 const ativos=useMemo(()=>linhas.filter(l=>l.jornada_ativa).length,[linhas,agora]);
 return <main className="min-h-screen bg-slate-100 pb-24 text-slate-950"><header className="bg-slate-950 px-5 py-7 text-white"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.3em] text-amber-400">SGF Nobre</p><h1 className="mt-2 text-3xl font-black">Central de Operações</h1><p className="mt-1 text-slate-400">Acompanhamento ao vivo dos motoristas e caminhões.</p></div></header><div className="mx-auto max-w-7xl p-5"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-slate-500">Motoristas cadastrados</p><p className="text-3xl font-black">{linhas.length}</p></div><div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-slate-500">Em operação</p><p className="text-3xl font-black text-emerald-600">{ativos}</p></div><div className="rounded-2xl bg-white p-5 shadow"><p className="text-sm text-slate-500">Atualização</p><p className="text-lg font-black">a cada 15 segundos</p></div></div>{msg&&<div className="mt-4 rounded-xl bg-red-100 p-4 text-red-800">{msg}</div>}<div className="mt-5 grid gap-4 lg:grid-cols-2">{linhas.map(l=><article key={l.motorista_id} className="rounded-3xl bg-white p-5 shadow"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{l.nome}</h2><p className="text-sm text-slate-500">{l.placa??"Sem veículo"}{l.modelo?` • ${l.modelo}`:""}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${l.jornada_ativa?"bg-emerald-100 text-emerald-800":"bg-slate-100 text-slate-500"}`}>{l.jornada_ativa?"EM OPERAÇÃO":"INATIVO"}</span></div><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs uppercase tracking-widest text-slate-400">Situação atual</p><p className="mt-1 text-lg font-black text-amber-400">{rotulo(l.tipo_evento)}</p><p className="mt-2 text-sm text-slate-300">Nesta etapa há {tempo(l.ocorrido_em)}</p></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Velocidade</p><p className="font-black">{l.velocidade_kmh==null?"—":`${Math.round(l.velocidade_kmh)} km/h`}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Último GPS</p><p className="font-black">{l.capturado_em?tempo(l.capturado_em)+" atrás":"Sem sinal"}</p></div></div>{l.latitude!=null&&<a className="mt-4 block rounded-xl border border-slate-200 px-4 py-3 text-center font-bold" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}>Abrir localização no mapa</a>}</article>)}</div></div><MobileNav/></main>}
