# Trans. Chávez — App de cobro

Monorepo con la app móvil del cobrador y el panel administrativo web para la
ruta intermunicipal de Trans. Chávez.

## Estructura

- `apps/mobile` — app del cobrador (Expo / React Native)
- `apps/web` — panel administrativo (Next.js)
- `packages/shared` — tipos, cliente de Supabase, cálculo de tarifas y validaciones compartidas
- `supabase/migrations` — esquema de base de datos y políticas de seguridad (RLS)
- `supabase/seed` — datos de ejemplo (una ruta con paradas y tarifas)

## 1. Crear el proyecto en Supabase

1. Crea una cuenta y un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el **SQL Editor** del proyecto, ejecuta en orden los archivos de
   `supabase/migrations/` (0001 a 0012).
3. Opcional: ejecuta `supabase/seed/seed.sql` para tener una ruta de ejemplo.
4. En **Project Settings → API**, copia la `Project URL`, la `anon key` y la
   `service_role key` (esta última nunca se expone al navegador).

## 2. Crear el primer usuario administrador

Los usuarios se crean vía Supabase Auth y automáticamente obtienen una fila en
`profiles` (rol `cobrador` por defecto, ver `0004_new_user_trigger.sql`). Para
crear el primer admin:

1. En el dashboard de Supabase: **Authentication → Users → Add user**, crea tu
   usuario admin con correo y contraseña.
2. En el **SQL Editor**, actualiza su rol:
   ```sql
   update profiles set role = 'admin' where id = '<uuid-del-usuario>';
   ```

Los cobradores se crean después desde el panel web (`Cobradores → Registrar
cobrador`), sin pasos manuales.

## 3. Configurar variables de entorno

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` en `apps/web/.env.local`, y
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` en
`apps/mobile/.env`.

## 4. Instalar dependencias

```bash
pnpm install
```

## 5. Correr las apps

```bash
pnpm dev:web      # panel administrativo en http://localhost:3000
pnpm dev:mobile   # abre Expo Go / simulador para la app del cobrador
```

## Flujo de prueba end-to-end

1. Entra al panel web con tu usuario admin.
2. Crea una ruta, agrega paradas en orden y define el precio "hasta el final" de cada parada, en ida y vuelta.
3. Crea un bus y registra un cobrador.
4. Programa un viaje asignando ruta, bus, cobrador y fecha/hora de salida.
5. Inicia sesión en la app móvil con la cuenta del cobrador, abre el viaje,
   elige el sentido (ida/vuelta) y registra boletos.
6. Vuelve al panel web → Dashboard: los ingresos deben aparecer ahí.
