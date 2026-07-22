-- Fonte única de horário para o SGF Nobre.
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create or replace function public.agora_servidor()
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select clock_timestamp();
$$;

grant execute on function public.agora_servidor() to authenticated;

-- Novas viagens recebem o horário do banco, nunca do celular/computador.
alter table public.viagens
  alter column iniciado_em set default clock_timestamp();

create or replace function public.definir_horarios_viagem()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.iniciado_em := clock_timestamp();
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'Em viagem'
     and new.status in ('Finalizada', 'Cancelada') then
    new.finalizado_em := clock_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists viagens_horario_servidor on public.viagens;

create trigger viagens_horario_servidor
before insert or update on public.viagens
for each row
execute function public.definir_horarios_viagem();
