# Nuvio Latam+ Plugin

Providers de películas, series y doramas en **español latino** para **Nuvio Media Hub**. Streams con audio latino, castellano o subtitulado desde las fuentes más populares.

---

## Plugin vs Add-on: ¿cuál es la diferencia?

Ambos conviven sin problema: puedes tener este plugin instalado junto a tantos add-ons como quieras.

Este es un plugin de nuvio. 

| Característica | Add-on | Plugin |
|---|---|---|
| Arquitectura | Cliente-servidor | Código ejecutado en el cliente |
| Ejecución de la lógica | Servidor remoto | Dispositivo donde corre Nuvio |
| Tecnología | API HTTP y respuestas JSON | JavaScript en un entorno QuickJS |
| Protocolo | Protocolo de add-ons de Stremio | Formato propio de Nuvio |
| Instalación | URL del manifiesto del add-on | Repositorio o manifiesto de plugins |
| Compatibilidad | Puede funcionar en otros clientes compatibles con Stremio | Específico de Nuvio |

---
## Instalación

Esto es un **plugin para Nuvio**. Para instalarlo:

1. Abre Nuvio y ve a **Profile → Content & Discovery → Plugins**
2. Agrega la manifest URL:
   ```
   https://raw.githubusercontent.com/ticolibre/NuvioLatam/main/manifest.json
   ```
3. Haz clic en **Install Plugins repository**

---

## Providers incluidos

| Provider | Películas | Series | Score |
|---|---|---|---|
| `7movies` | ✅ | ✅ | 5/5 ⭐ |
| `allcalidad` | ✅ | ✅ | 5/5 ⭐ |
| `animeav1` | ✅ | ✅ | 3/5 |
| `animejl` | ✅ | ✅ | 4/5 |
| `areshd` | ✅ | ✅ | 2/5 |
| `cinecalidad` | ✅ | ❌ | 3/4 |
| `cinehax` | ✅ | ✅ | 5/5 ⭐ |
| `cinehaxplus` | ✅ | ✅ | 1/5 |
| `cinehdplus` | ✅ | ✅ | 4/5 |
| `cuevana` | ✅ | ✅ | 0/5 |
| `deepflix` | ✅ | ✅ | 5/5 ⭐ |
| `detodopeliculas` | ✅ | ✅ | 3/5 |
| `doramasflix` | ✅ | ✅ | 2/5 |
| `embed69` | ✅ | ✅ | 4/5 |
| `henaojara` | ✅ | ✅ | 3/5 |
| `jkanime` | ✅ | ✅ | 3/5 |
| `lamovie` | ✅ | ✅ | 4/5 |
| `latanime` | ✅ | ✅ | 4/5 |
| `max` | ✅ | ✅ | 5/5 ⭐ |
| `monoschinos` | ✅ | ✅ | 4/5 |
| `pelispedia` | ✅ | ✅ | 5/5 ⭐ |
| `pelisforte` | ✅ | ✅ | 3/5 |
| `pelisplus` | ✅ | ✅ | 2/5 |
| `peliserieshoy` | ✅ | ✅ | 0/5 |
| `seriesflix` | ✅ | ✅ | 4/5 |
| `seriesmetro` | ✅ | ✅ | 4/5 |
| `sololatino` | ✅ | ✅ | 5/5 ⭐ |
| `tioanime` | ✅ | ✅ | 1/5 |

**Qué se probó:** a cada provider se le pasó el ID de TMDB de cada título y se llamó `getStreams(tmdbId, tipo, temporada, episodio)`. Un título cuenta como aprobado si devolvió al menos un stream con `url` o `infoHash`; `EMPTY`, `TIMEOUT` y `ERROR` cuentan como fallo.

**Score:** cantidad de títulos con al menos un stream (`OK`) sobre el total de títulos aplicables. `⭐` significa puntuación perfecta: el provider encontró **todos** los títulos de su suite.

- Los providers de **anime** se prueban contra 5 anime: *Naruto*, *Jujutsu Kaisen*, *One Piece*, *Demon Slayer* y *Solo Leveling*.
- El resto se prueba contra 5 películas/series: *Obsession*, *Backrooms* (2026), *Parasite*, *Squid Game* y *Toy Story 5*.
- `cinecalidad` solo soporta películas, así que su máximo aplicable es `4/4`.
- Última prueba: **9 nov 2026**, con `--score --timeout=30000 --concurrency=8`. El score es una foto del momento: los sitios cambian y un provider puede fallar de forma intermitente.

---

## Pruebas locales (opcional)

El repositorio incluye `test.js` para comprobar los providers desde tu PC. **No se ejecuta dentro de Nuvio**: es solo una herramienta de desarrollo.

Requisitos: Node.js 18 o superior y `crypto-js` (`npm install crypto-js`).

```bash
node test.js                          # score: anime vs 5 anime, el resto vs 5 películas/series
node test.js --score --json           # mismo test, salida JSON (para actualizar el README)
node test.js --suite=anime --matrix   # matriz de todos los providers contra los 5 anime
node test.js --suite=general --matrix # matriz contra los 5 títulos generales
node test.js --fixtures=squidgame     # un solo título, para todos los providers
node test.js --only=jkanime -v        # un provider concreto, mostrando sus logs
node test.js --list                   # ver providers, suites y títulos sin ejecutar nada
```

Modos:

- **score** (por defecto): cada provider se prueba contra su suite y se calcula `OK / aplicables`. Los providers de anime usan la suite de anime; el resto, la general.
- **`--cascade`**: todos contra el primer título; solo los que fallan pasan al siguiente.
- **`--matrix`**: todos los providers contra todos los títulos seleccionados.

Opciones útiles: `--suite=auto|general|anime|all`, `--fixtures=...`, `--only=...`, `--skip=...`, `--timeout=30000`, `--concurrency=6`, `--strict` (sale con error si algún provider no es perfecto).

Estados: `OK n` (n streams), `EMPTY` (respondió sin streams), `TIMEOUT`, `ERROR` y `—` (tipo no soportado). En el score, `—` no cuenta en el denominador porque ese título no aplica al provider.

---

## Descargo de Responsabilidad

**Nuvio Latam+ Plugin no tiene ninguna asociación, afiliación ni relación con los sitios web de los cuales los scripts obtienen el contenido.** 

Los administradores de esos sitios pueden en cualquier momento y sin previo aviso cerrar el sitio, mudar su contenido a otro dominio o implementar medidas que impidan el scraping. Cuando eso ocurra, uno o varios providers de este plugin pueden dejar de funcionar de un día para otro.

Por eso recomiendo no depender de una sola fuente: complementa este plugin con **add-ons** adicionales para tener siempre alternativas disponibles.
