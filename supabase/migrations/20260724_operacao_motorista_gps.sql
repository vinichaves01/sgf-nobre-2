-- SGF Nobre Transportadora — operação por eventos e GPS via celular
-- Execute uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.jornadas_motorista (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  veiculo_id uuid null references public.veiculos(id) on delete set null,
  iniciada_em timestamptz not null default clock_timestamp(),
  encerrada_em timestamptz null,
  status text not null default 'Ativa' check (status in ('Ativa','Encerrada')),
  observacao text null,
  created_at timestamptz not null default clock_timestamp()
);

create unique index if not exists uma_jornada_ativa_por_motorista
  on public.jornadas_motorista(motorista_id)
  where status = 'Ativa';

create table if not exists public.eventos_operacionais (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas_motorista(id) on delete cascade,
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  veiculo_id uuid null references public.veiculos(id) on delete set null,
  viagem_id uuid null references public.viagens(id) on delete set null,
  tipo_evento text not null check (tipo_evento in (
    'JORNADA_INICIADA','SAINDO_PARA_CARREGAMENTO','CHEGOU_CARREGAMENTO',
    'CARREGADO_SAINDO_DESCARGA','CHEGOU_DESCARGA','DESCARGA_CONCLUIDA',
    'AGUARDANDO_DESTINO','ABASTECIMENTO_INICIADO','ABASTECIMENTO_CONCLUIDO',
    'DESCANSO_INICIADO','DESCANSO_FINALIZADO','MANUTENCAO_INICIADA',
    'MANUTENCAO_FINALIZADA','JORNADA_ENCERRADA'
  )),
  ocorrido_em timestamptz not null default clock_timestamp(),
  latitude double precision null,
  longitude double precision null,
  precisao_metros double precision null,
  observacao text null,
  criado_por uuid not null default auth.uid(),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists eventos_operacionais_motorista_data
  on public.eventos_operacionais(motorista_id, ocorrido_em desc);
create index if not exists eventos_operacionais_jornada_data
  on public.eventos_operacionais(jornada_id, ocorrido_em asc);

create table if not exists public.localizacoes_gps (
  id bigint generated always as identity primary key,
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  veiculo_id uuid null references public.veiculos(id) on delete set null,
  jornada_id uuid null references public.jornadas_motorista(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  precisao_metros double precision null,
  velocidade_kmh double precision null,
  direcao_graus double precision null,
  altitude_metros double precision null,
  capturado_em timestamptz not null default clock_timestamp(),
  recebido_em timestamptz not null default clock_timestamp()
);

create index if not exists localizacoes_gps_motorista_data
  on public.localizacoes_gps(motorista_id, capturado_em desc);
create index if not exists localizacoes_gps_jornada_data
  on public.localizacoes_gps(jornada_id, capturado_em asc);

create table if not exists public.pontos_operacionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'Outro' check (tipo in ('Carregamento','Descarga','Posto','Base','Oficina','Outro')),
  latitude double precision not null,
  longitude double precision not null,
  raio_metros integer not null default 250 check (raio_metros between 30 and 5000),
  ativo boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);

create or replace function public.motorista_logado_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.motorista_id from public.perfis p where p.id = auth.uid() and p.ativo = true),
    (select m.id from public.motoristas m where m.auth_user_id = auth.uid() limit 1)
  );
$$;

grant execute on function public.motorista_logado_id() to authenticated;

create or replace function public.registrar_evento_operacional(
  p_tipo_evento text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_precisao_metros double precision default null,
  p_observacao text default null
)
returns public.eventos_operacionais
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motorista uuid;
  v_jornada public.jornadas_motorista;
  v_evento public.eventos_operacionais;
  v_veiculo uuid;
  v_ultimo text;
  v_permitidos text[];
begin
  v_motorista := public.motorista_logado_id();
  if v_motorista is null then raise exception 'Motorista não vinculado ao usuário autenticado.'; end if;

  select veiculo_id into v_veiculo from public.motoristas where id = v_motorista;
  select * into v_jornada from public.jornadas_motorista
    where motorista_id = v_motorista and status = 'Ativa'
    order by iniciada_em desc limit 1 for update;

  if p_tipo_evento = 'JORNADA_INICIADA' then
    if v_jornada.id is not null then raise exception 'Já existe uma jornada ativa.'; end if;
    insert into public.jornadas_motorista(motorista_id, veiculo_id)
      values (v_motorista, v_veiculo) returning * into v_jornada;
  elsif v_jornada.id is null then
    raise exception 'Inicie a jornada antes de registrar atividades.';
  end if;

  select tipo_evento into v_ultimo from public.eventos_operacionais
    where jornada_id = v_jornada.id order by ocorrido_em desc, created_at desc limit 1;

  v_permitidos := case coalesce(v_ultimo, '')
    when '' then array['JORNADA_INICIADA']
    when 'JORNADA_INICIADA' then array['SAINDO_PARA_CARREGAMENTO','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','MANUTENCAO_INICIADA','JORNADA_ENCERRADA']
    when 'SAINDO_PARA_CARREGAMENTO' then array['CHEGOU_CARREGAMENTO','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','MANUTENCAO_INICIADA']
    when 'CHEGOU_CARREGAMENTO' then array['CARREGADO_SAINDO_DESCARGA']
    when 'CARREGADO_SAINDO_DESCARGA' then array['CHEGOU_DESCARGA','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','MANUTENCAO_INICIADA']
    when 'CHEGOU_DESCARGA' then array['DESCARGA_CONCLUIDA']
    when 'DESCARGA_CONCLUIDA' then array['SAINDO_PARA_CARREGAMENTO','AGUARDANDO_DESTINO','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','MANUTENCAO_INICIADA','JORNADA_ENCERRADA']
    when 'AGUARDANDO_DESTINO' then array['SAINDO_PARA_CARREGAMENTO','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','MANUTENCAO_INICIADA','JORNADA_ENCERRADA']
    when 'ABASTECIMENTO_INICIADO' then array['ABASTECIMENTO_CONCLUIDO']
    when 'ABASTECIMENTO_CONCLUIDO' then array['SAINDO_PARA_CARREGAMENTO','DESCANSO_INICIADO','MANUTENCAO_INICIADA','JORNADA_ENCERRADA']
    when 'DESCANSO_INICIADO' then array['DESCANSO_FINALIZADO']
    when 'DESCANSO_FINALIZADO' then array['SAINDO_PARA_CARREGAMENTO','ABASTECIMENTO_INICIADO','MANUTENCAO_INICIADA','JORNADA_ENCERRADA']
    when 'MANUTENCAO_INICIADA' then array['MANUTENCAO_FINALIZADA']
    when 'MANUTENCAO_FINALIZADA' then array['SAINDO_PARA_CARREGAMENTO','ABASTECIMENTO_INICIADO','DESCANSO_INICIADO','JORNADA_ENCERRADA']
    else array[]::text[] end;

  if not (p_tipo_evento = any(v_permitidos)) then
    raise exception 'Evento % não permitido após %.', p_tipo_evento, coalesce(v_ultimo,'nenhum evento');
  end if;

  insert into public.eventos_operacionais(
    jornada_id,motorista_id,veiculo_id,tipo_evento,latitude,longitude,precisao_metros,observacao
  ) values (
    v_jornada.id,v_motorista,v_veiculo,p_tipo_evento,p_latitude,p_longitude,p_precisao_metros,p_observacao
  ) returning * into v_evento;

  if p_tipo_evento = 'JORNADA_ENCERRADA' then
    update public.jornadas_motorista set status='Encerrada', encerrada_em=clock_timestamp() where id=v_jornada.id;
  end if;

  return v_evento;
end;
$$;

grant execute on function public.registrar_evento_operacional(text,double precision,double precision,double precision,text) to authenticated;

alter table public.jornadas_motorista enable row level security;
alter table public.eventos_operacionais enable row level security;
alter table public.localizacoes_gps enable row level security;
alter table public.pontos_operacionais enable row level security;

create policy "jornada_motorista_ve_propria" on public.jornadas_motorista for select to authenticated
using (motorista_id = public.motorista_logado_id() or public.usuario_e_administrador());
create policy "eventos_motorista_ve_proprios" on public.eventos_operacionais for select to authenticated
using (motorista_id = public.motorista_logado_id() or public.usuario_e_administrador());
create policy "gps_motorista_insere_proprio" on public.localizacoes_gps for insert to authenticated
with check (motorista_id = public.motorista_logado_id());
create policy "gps_motorista_ve_proprio_admin_ve_todos" on public.localizacoes_gps for select to authenticated
using (motorista_id = public.motorista_logado_id() or public.usuario_e_administrador());
create policy "pontos_todos_veem" on public.pontos_operacionais for select to authenticated using (ativo = true or public.usuario_e_administrador());
create policy "pontos_admin_gerencia" on public.pontos_operacionais for all to authenticated
using (public.usuario_e_administrador()) with check (public.usuario_e_administrador());

-- Inclua as novas tabelas na publicação do Realtime pelo painel do Supabase,
-- ou execute os comandos abaixo se ainda não estiverem publicadas:
do $$ begin
  alter publication supabase_realtime add table public.eventos_operacionais;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.localizacoes_gps;
exception when duplicate_object then null; end $$;
