-- Módulo de usuários e acessos do SGF Nobre

alter table public.perfis
  add column if not exists motorista_id uuid null references public.motoristas(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists perfis_motorista_id_unico
  on public.perfis(motorista_id)
  where motorista_id is not null;

create or replace function public.usuario_e_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and tipo = 'Administrador'
      and ativo = true
  );
$$;

grant execute on function public.usuario_e_administrador() to authenticated;

alter table public.perfis enable row level security;

drop policy if exists "perfis_usuario_ve_proprio" on public.perfis;
create policy "perfis_usuario_ve_proprio"
on public.perfis
for select
to authenticated
using (id = auth.uid());

drop policy if exists "perfis_admin_ve_todos" on public.perfis;
create policy "perfis_admin_ve_todos"
on public.perfis
for select
to authenticated
using (public.usuario_e_administrador());

drop policy if exists "perfis_admin_atualiza" on public.perfis;
create policy "perfis_admin_atualiza"
on public.perfis
for update
to authenticated
using (public.usuario_e_administrador())
with check (public.usuario_e_administrador());

-- A criação e alteração de contas Auth é feita somente pela rota segura do servidor,
-- usando SUPABASE_SERVICE_ROLE_KEY configurada na Vercel.
