# ADR-002 — Framework del agente local (lectura serial + offline)

- **Estado:** propuesto (confirma el humano). Refina D5.
- **Contexto:** el "agente" es **software propio** que corre en el PC del detector y hace:
  leer serial (Win/Mac/Linux), parsear (ver `SERIAL-FORMATS.md`), **respaldo local (SQLite)**,
  cola de sync offline idempotente, **auto-actualización**, e instalación fácil para usuarios
  no técnicos. El framework es solo la herramienta para construirlo; **la lógica es nuestra**.

## Aclaración

"¿Podemos hacer un agente propio?" — **Sí, y lo hacemos.** Tauri/Go/Electron/etc. son solo el
*toolkit* de empaquetado y acceso a hardware; toda la lógica (parser, buffer, sync) la
escribimos nosotros en `apps/agent`. La decisión es **qué toolkit** minimiza fricción y riesgo.

## Opciones evaluadas

| Opción | Footprint | Serial | UI | Auto-update | Veredicto |
|--------|-----------|--------|----|-------------|-----------|
| **Tauri** (Rust + web UI) | ~3–10 MB, RAM baja | crate `serialport` (sólido) | reusa React (consistente con la web) | **updater integrado firmado** | ✅ **Primario** |
| **Go** (binario estático) | ~5–15 MB, RAM muy baja | `go.bug.st/serial` (excelente) | tray + página local, o headless | vía librería/propio | 🟢 **Alternativa fuerte** (el más simple como *daemon* headless) |
| Electron (Node+Chromium) | 100+ MB, RAM alta | `serialport` npm (maduro) | React | `electron-updater` | 🟠 Demasiado pesado para un logger de fondo |
| Node empaquetado (pkg/nexe) | medio | `serialport` (módulos nativos, frágil de empaquetar) | web local/tray | propio | 🟠 Empaquetado nativo problemático |
| Python (PyInstaller) | grande | `pyserial` (referencia) | — | difícil | 🔴 No por el lenguaje, sino por la **fricción de distribución** (ver nota) |

> **Aclaración (no es rechazo a Python):** el objetivo es **instalación intuitiva, tipo
> "un clic"** — el usuario NO debe descargar código, instalar Python, tener un IDE, ni ejecutar
> scripts a mano (eso falla y frustra). Python es excelente para prototipos/servidor; solo se
> evita como **agente de usuario final** porque empaquetarlo en un instalador limpio y sin
> dependencias es frágil. Cualquier opción elegida DEBE entregarse como instalador de un clic.
| PWA + Web Serial | nulo (sin instalar) | Web Serial (solo Chromium) | la web | auto (es web) | 🟡 **Complemento** zero-install, no reemplaza (sin background ni Firefox/Safari) |

## Decisión propuesta

- **Primario: Tauri.** Footprint mínimo, updater firmado integrado, **UI consistente** con la
  app web (mismo React/Tailwind), seguridad. Encaja con el equipo web/TS y con el principio de
  buena UX (D23).
- **Alternativa documentada: Go**, si el acceso serial en Rust o el empaquetado dieran
  problemas, o si se prefiere un **daemon headless** ultraligero para PCs de laboratorio
  modestos/servidores de toma de datos. Misma arquitectura (parser/buffer/sync portados).
- **Complemento: PWA + Web Serial** como camino **zero-install** para usuarios casuales en
  Chromium (sin offline robusto). No sustituye al agente.

## Consecuencias

- El **parser y la lógica de sync se diseñan agnósticos del framework** (módulos claros) para
  poder mover de Tauri a Go sin reescribir la lógica, solo el "cascarón".
- El agente habla con la nube **solo vía la misma API/`DataProvider`** (no SDK directo).
- Riesgo R-serial (Rust): mitigado porque `serialport` (Rust) es maduro; si falla, plan B = Go.

## Pendiente para el humano
¿Mantener **Tauri** como primario (recomendado), o prefieres que el primario sea **Go**
(daemon headless ultraligero) con una UI web mínima?
