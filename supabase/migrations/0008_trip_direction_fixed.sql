-- El sentido (ida/vuelta) se define al crear el viaje y ya no se puede cambiar:
-- todos los boletos del viaje van en ese sentido.

alter table trips add column direction trip_direction not null default 'outbound';

create or replace function enforce_cobrador_trip_update()
returns trigger
language plpgsql
as $$
begin
  -- Ruta y sentido son inmutables para todos (admin incluido)
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

  if new.status is distinct from old.status and not (
    (old.status = 'scheduled' and new.status = 'in_progress') or
    (old.status = 'in_progress' and new.status = 'completed')
  ) then
    raise exception 'Cambio de estado no permitido';
  end if;

  return new;
end;
$$;
