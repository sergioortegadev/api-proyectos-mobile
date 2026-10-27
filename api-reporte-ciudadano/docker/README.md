# Stack local: API + PostgreSQL + pgAdmin (Docker)

Levanta tres contenedores: la API de Reporte Ciudadano (`rc-api`), PostgreSQL 17 (`rc-postgres`) y pgAdmin (`rc-pgadmin`).
Los datos se guardan en `docker/data/`, en tu disco: sobreviven aunque borres los contenedores.

## Requisitos

- Docker con Docker Compose v2 (`docker compose version`).
- Linux o Mac. En Windows, usá WSL2.

## Primera vez

Todos los comandos se corren **desde esta carpeta** (`api-reporte-ciudadano/docker`).

```bash
# 1. Bajar el fork del grupo y cambiar de rama
git clone <URL-DEL-FORK> && cd <repo>/api-reporte-ciudadano   # ajustá la ruta a tu repo
git checkout <RAMA-DEL-GRUPO>
cd docker

# 2. Configuración
cp .env.example .env          # editá las claves si querés

# 3. Carpetas de datos (si no existen)
mkdir -p data/postgres data/archivos data/pgadmin

# 4. Permisos (solo Linux; en Mac con Docker Desktop no hace falta)
sudo chown -R 5050:5050 data/pgadmin     # pgAdmin corre como uid 5050
sudo chown -R 1000:1000 data/archivos    # la API corre como uid 1000 (ya es tuyo si tu usuario es el 1000)

# 5. Levantar todo (la primera vez tarda unos minutos: arma la imagen de la API)
docker compose up -d --build
```

## Comprobar que anda

| Qué                                  | Dónde                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Estado de la API                     | <http://localhost:3000/salud> → `"estado": "ok"`                                |
| Documentación de endpoints (Swagger) | <http://localhost:3000/docs>                                                    |
| pgAdmin                              | <http://localhost:8080> (usuario y clave: los de `PGADMIN_DEFAULT_*` en `.env`) |

**Conectar pgAdmin a la base** (una sola vez): _Register → Server_.
En _Connection_: Host `postgres`, Port `5432`, Maintenance database `reporte_ciudadano`, Username y Password los de `POSTGRES_*` en `.env`.

Si ya tenés un Postgres local en el 5432, cambiá `PUERTO_DB` en `.env`.

## Datos de demo (los mismos de los mocks de la app)

La primera vez, con la base vacía, la API carga 4 tipos de reporte, 4 zonas, 8 cuadrillas, 8 reportes y estos usuarios. **Todos entran con la contraseña `demo1234`.**

| Email | Rol |
|---|---|
| `vecino@gualeguaychu.gov.ar` | vecino (Juan Pérez, tiene reportes propios) |
| `operador@gualeguaychu.gov.ar` | operador de la Zona Norte (María Gómez) |
| `vecino2@gualeguaychu.gov.ar`, `vecino3@gualeguaychu.gov.ar` | vecinos con reportes |

El código que carga estos datos está en `src/seeds/group.ts`; se activa con `SEMILLAS: grupo` en `compose.yaml`.

## Comandos útiles

```bash
docker compose logs -f api        # ver los logs de la API
docker compose ps                 # estado de los contenedores
docker compose stop               # apagar (los datos se conservan)
docker compose up -d              # volver a prender
docker compose down               # borrar los contenedores (los datos en data/ se conservan)
```

**Volver a cero** (borra la base y las fotos; al arrancar se vuelven a cargar los datos de demo):

```bash
docker compose down
sudo find data/postgres data/archivos -mindepth 1 -delete   # funciona en bash y en zsh, aunque las carpetas estén vacías
docker compose up -d
```

Si cambiás código de la API: `docker compose up -d --build api`.

## Conectar la app del celular

El celular **no** llega a `localhost`. Usá la IP de la compu donde corre Docker:

```bash
hostname -I        # Linux  (o: ip addr)
ipconfig getifaddr en0   # Mac
```

En el proyecto de la app (`uner-mobile-grupo-3`), copiá `.env.example` como `.env.local` y dejalo así (este archivo no se sube a git):

```dotenv
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=http://<esa-ip>:3000
```

Después `npx expo start -c`. Con `EXPO_PUBLIC_USE_MOCK=true` (o sin la variable) la app usa datos de prueba y no necesita la API.
Con el emulador de Android en la misma compu, usá `http://10.0.2.2:3000`.

Si no conecta: verificar misma red wifi, y si usas Linux abrí el puerto: `sudo ufw allow 3000/tcp`.
