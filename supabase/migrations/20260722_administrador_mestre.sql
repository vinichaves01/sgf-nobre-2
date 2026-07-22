-- Proteção da conta principal do SGF Nobre.
-- Execute uma única vez no SQL Editor do Supabase.

alter table public.perfis
  add column if not exists administrador_mestre boolean not null default false;

-- Marca como Administrador Mestre a conta administradora mais antiga.
-- No projeto atual, isso corresponde à conta principal já existente.
with primeiro_administrador as (
  select id
  from public.perfis
  where tipo = 'Administrador'
  order by id asc
  limit 1
)
update public.perfis
set administrador_mestre = true
where id in (select id from primeiro_administrador)
  and not exists (
    select 1 from public.perfis where administrador_mestre = true
  );

create unique index if not exists somente_um_administrador_mestre
  on public.perfis ((administrador_mestre))
  where administrador_mestre = true;

create or replace function public.proteger_administrador_mestre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.administrador_mestre then
    if tg_op = 'DELETE' then
      raise exception 'A conta do Administrador Mestre não pode ser excluída.';
    end if;

    if new.administrador_mestre is distinct from true
       or new.tipo is distinct from 'Administrador'
       or new.ativo is distinct from true then
      raise exception 'O Administrador Mestre não pode ser removido, bloqueado ou rebaixado.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists proteger_administrador_mestre on public.perfis;
create trigger proteger_administrador_mestre
before update or delete on public.perfis
for each row
execute function public.proteger_administrador_mestre();
