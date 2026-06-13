# Bot de musica para Discord

Bot de musica escrito en Node.js que busca contenido en YouTube y lo reproduce
en canales de voz de Discord. Incluye autocompletado, selector de resultados,
cola independiente por servidor y controles interactivos.

## Caracteristicas

- Busqueda de hasta 10 resultados en YouTube.
- Autocompletado nativo con `/play`.
- Comandos tradicionales con prefijo `!`.
- Cola independiente para cada servidor.
- Botones de pausa, reanudacion, salto, parada y cola.
- Mensajes sin miniaturas ni vistas previas de YouTube.
- Desconexion automatica cuando la cola queda inactiva.
- Ejecucion local o mediante Docker.
- Instalacion completa con npm, sin rutas externas ni cookies.

## Requisitos

- Node.js 22.13 o posterior.
- Un bot creado en Discord Developer Portal.
- Permisos para conectar y hablar en el canal de voz.

## Configurar Discord

1. Abre <https://discord.com/developers/applications>.
2. Crea una aplicacion y agrega un bot.
3. Copia el token desde la seccion **Bot**.
4. Activa **Message Content Intent** para usar comandos con `!`.
5. En **OAuth2 > URL Generator**, selecciona los scopes `bot` y
   `applications.commands`.
6. Concede estos permisos:
   `View Channels`, `Send Messages`, `Read Message History`, `Connect` y
   `Speak`.
7. Abre la URL generada e invita el bot a tu servidor.

## Configuracion

Crea el archivo de entorno:

```powershell
Copy-Item .env.example .env
```

Completa al menos el token:

```dotenv
DISCORD_TOKEN=token_del_bot
COMMAND_PREFIX=!
```

Variables disponibles:

| Variable                    | Predeterminado | Descripcion                                  |
| --------------------------- | -------------- | -------------------------------------------- |
| `DISCORD_TOKEN`             | Obligatoria    | Token privado del bot.                       |
| `COMMAND_PREFIX`            | `!`            | Prefijo de los comandos de texto.            |
| `DISCORD_CHANNEL_ID`        | Sin limite     | Canal de texto permitido.                    |
| `DISCORD_GUILD_ID`          | Todos          | Servidor donde registrar los comandos slash. |
| `MAX_QUEUE_SIZE`            | `100`          | Numero maximo de canciones en cola.          |
| `SELECTION_TIMEOUT_SECONDS` | `90`           | Tiempo para elegir un resultado.             |
| `IDLE_TIMEOUT_SECONDS`      | `300`          | Tiempo antes de desconectar el bot inactivo. |
| `LOG_LEVEL`                 | `info`         | Nivel: `debug`, `info`, `warn` o `error`.    |

No publiques `.env` ni compartas `DISCORD_TOKEN`.

## Iniciar en local

Instala las dependencias:

```powershell
npm install
```

Modo desarrollo con recarga automatica:

```powershell
npm run dev
```

Modo normal:

```powershell
npm start
```

## Iniciar con Docker

```powershell
docker compose up --build -d
docker compose logs -f
```

Detener el contenedor:

```powershell
docker compose down
```

## Comandos

### Comandos slash

| Comando          | Accion                                            |
| ---------------- | ------------------------------------------------- |
| `/play cancion:` | Busca mientras escribes y reproduce la seleccion. |
| `/pause`         | Pausa la cancion actual.                          |
| `/resume`        | Reanuda la reproduccion.                          |
| `/skip`          | Salta a la siguiente cancion.                     |
| `/stop`          | Detiene, vacia la cola y desconecta.              |
| `/queue`         | Muestra la cola.                                  |
| `/nowplaying`    | Muestra la cancion actual.                        |
| `/leave`         | Desconecta el bot.                                |
| `/help`          | Muestra la ayuda.                                 |

### Comandos con prefijo

| Comando                    | Accion                                 |
| -------------------------- | -------------------------------------- |
| `!play nombre`             | Muestra un selector con 10 resultados. |
| `!play URL`                | Agrega directamente un video.          |
| `!pause` / `!pausa`        | Pausa la reproduccion.                 |
| `!resume` / `!reanudar`    | Reanuda la reproduccion.               |
| `!skip` / `!saltar`        | Salta la cancion actual.               |
| `!stop` / `!detener`       | Detiene y vacia la cola.               |
| `!queue` / `!cola`         | Muestra la cola.                       |
| `!nowplaying` / `!sonando` | Muestra la cancion actual.             |
| `!help` / `!ayuda`         | Muestra la ayuda.                      |

Para reproducir musica, el usuario debe estar conectado a un canal de voz. Los
botones **Pausa**, **Play**, **Saltar**, **Stop** y **Cola** aparecen debajo del
mensaje de reproduccion.

## Calidad del codigo

```powershell
npm run lint
npm run format
```

Para aplicar el formato automaticamente:

```powershell
npm run format:write
```

## Estructura

```text
src/
|-- app/                 Cliente y eventos de Discord
|-- commands/            Comandos, alias y cooldown
|-- config/              Variables de entorno
|-- discord/             Selectores, botones y comandos slash
|-- services/
|   |-- player/          Voz, cola y FFmpeg
|   `-- youtube/         Busqueda y resolucion de audio
|-- shared/              Logger y utilidades
`-- index.js             Punto de entrada
```

## Consideraciones

La integracion utiliza clientes publicos de YouTube sin cookies. YouTube puede
cambiar sus mecanismos, restringir videos o bloquear temporalmente una IP. No
se garantiza la reproduccion de contenido privado, regional, premium, protegido
con DRM o que requiera iniciar sesion.

Usa el bot solamente con contenido que tengas derecho a reproducir.
