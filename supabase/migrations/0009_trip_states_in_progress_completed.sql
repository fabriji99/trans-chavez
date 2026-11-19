-- Los viajes solo tienen dos estados: in_progress (En curso) y completed (Finalizado).
-- El estado cambia únicamente cuando el cobrador inicia o finaliza el viaje desde la app.
-- El valor 'scheduled' del enum queda sin uso.

update trips set status = 'in_progress' where status = 'scheduled'
  and not exists (
    select 1 from trips t2 where t2.cobrador_id = trips.cobrador_id and t2.status = 'in_progress'
  );
update trips set status = 'completed' where status = 'scheduled';

alter table trips alter column status set default 'in_progress';

create or replace function enforce_cobrador_trip_update()
returns trigger
language plpgsql
as $$
begin
  if new.route_id is distinct from old.route_id
     or new.direction is distinct from old.direction then
    raise exception 'La ruta y el sentido del viaje no se pueden modificar';
  end if;

  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.cobrador_id is distinct from old.cobrador_id then
    raise exception 'No puedes cambiar el cobrador del viaje';
  end if;

  if old.status = 'completed' then
    raise exception 'El viaje ya fue finalizado';
  end if;

  if new.status is distinct from old.status
     and not (old.status = 'in_progress' and new.status = 'completed') then
    raise exception 'Cambio de estado no permitido';
  end if;

  return new;
end;
$$;
