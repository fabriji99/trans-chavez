-- Una sola sesión activa por usuario: al iniciar sesión en un dispositivo,
-- se cierran las sesiones que ese usuario tuviera abiertas en otros.
-- Se llama justo después de iniciar sesión (web y app móvil).
create or replace function claim_single_session()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_uid is null or v_sid is null then
    return;
  end if;
  -- Borrar la sesión invalida también sus tokens de renovación
  delete from auth.sessions where user_id = v_uid and id <> v_sid;
end;
$$;

revoke execute on function claim_single_session() from public, anon;
grant execute on function claim_single_session() to authenticated;
