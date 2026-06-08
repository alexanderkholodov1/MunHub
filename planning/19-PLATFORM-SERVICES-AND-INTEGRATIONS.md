# MunHub Lab v6.0 — Servicios de plataforma e integraciones

> Depende de: `00-MASTER-PLAN.md`, `01-ARCHITECTURE.md`, `18-...`. Responde a dos preguntas de
> Alexander: (1) **exprimir Firebase al máximo** (autonomía: vivir como si Firebase fuera el techo,
> sin depender de Red Clara), y (2) **¿qué integraciones externas tienen sentido?** (Notion, n8n,
> Slack, etc.) para que el proyecto sea una **визитная карточка / calling card** ejemplar en
> investigación, diseño, full-stack y gestión de servidores.

---

## 0. Principio rector — "Firebase-complete por defecto" (D37, propuesta)

Diseñar el producto para correr **completo e indefinido sobre Firebase gratuito (Spark)**.
Red Clara / Supabase = **upgrade opcional, nunca requisito**. Esto:
- valida nuestra arquitectura de **procesamiento en el borde** (el agente Tauri hace el trabajo
  pesado → alivia/eluda el servidor),
- se apoya en que Spark **bloquea, no cobra** (billing-proof, D18),
- y la **capa agnóstica** (`data-provider` + un `AuthProvider`/`StorageProvider`) permite migrar a
  Supabase sin reescribir la app. **Todo servicio Firebase se usa detrás de nuestra interfaz**, no
  directo desde la app (guardrail #6).

---

## 1. Firebase al máximo (verificado, junio 2026)

### Usar YA — gratis y billing-proof
| Servicio | Para qué en MunHub | Nota |
|---|---|---|
| **Authentication** | Cuenta MunHub (email/pass + Google), verificación, reset; **custom claims = roles** (admin/user/guest) sin lecturas extra a la DB | Reemplaza el auth artesanal v5. Detrás de un `AuthProvider` (Supabase Auth mapea 1:1 en Fase B). |
| **Realtime Database** | Streaming + `latest` (ya en uso, munhub-1) | Mantener para tiempo real. |
| **Cloud Storage** | CSV/ZIP backups, logos de institución, avatares, firmware del detector | 5GB en Spark; detrás de `StorageProvider`. |
| **Hosting** | Fase A (ya en uso) + previews por PR | Static export (D18). |
| **Cloud Messaging (FCM)** | Push web del centro de notificaciones (Forbush detectado, detector caído) | Gratis; alimenta `notifications` (doc 12). |
| **App Check** | Anti-abuso: asegura que las peticiones vienen de nuestra app | Endurecimiento de seguridad, gratis. |
| **Remote Config** | Implementar `feature_flags` (doc 15) sin redeploy | Gratis. |
| **Performance Monitoring + Analytics** | Observabilidad web (web vitals, uso) — credibilidad "exemplary" | Gratis. |

### Usar con cuidado — Functions (2M invocaciones/mes gratis en Spark)
**Cloud Functions** ahora tienen **2M invocaciones/mes en Spark**; si se excede, **se apaga (no
cobra)**. Las usamos para lo que NO debe vivir en el cliente:
- **Respaldos fríos programados** → Cloudflare R2 (capa 3, D10/D16).
- **Fetch de APIs externas** (NMDB/NOAA/DONKI/Dst-Kp, doc 07) con caché idempotente.
- **Email transaccional** (verificación, tickets, alertas) y **agregaciones**.

> ⚠️ Verificar en el primer deploy si Firebase exige Blaze para *desplegar* Functions (históricamente
> usaban Cloud Build). Si lo exige: Blaze **con presupuesto tope estricto** + alertas. Plan B sin
> Functions: el **agente Tauri** hace backups/fetch en el borde (ya es nuestra filosofía).

### Opcional para UX (NO para la ciencia) — Firebase AI Logic / Gemini
Free tier de Gemini usable en Spark **sin tarjeta**. Permitido SOLO para features de experiencia:
**asistente de ayuda, búsqueda semántica de docs, consulta en lenguaje natural** ("muéstrame el
Forbush de marzo"). 🔒 **Prohibido para el pipeline científico** (D12: modelo propio, reproducible,
sin dependencia externa). Si se usa, modelo actual `gemini-3.1-flash-lite` (el 2.0 Flash se retiró
el 1-jun-2026).

### Evitar (por ahora)
- **App Hosting** (SSR gestionado) → riesgo de cobro, evitado en D18.
- **Firestore** → seguimos con RTDB salvo que necesitemos queries ricas (listar estaciones públicas
  con filtros). Si llega esa necesidad, evaluamos Firestore para metadatos + RTDB para streaming.

---

## 2. Integraciones externas — veredicto honesto (de maestro)

**Filosofía:** una calling card impresiona por ser **coherente y bien ejecutada**, no por un
*kitchen-sink* de integraciones. Cada integración debe ganar su mantenimiento. Mi criterio:

| Herramienta | ¿Tiene sentido? | Veredicto |
|---|---|---|
| **Notion** (docs) | ❌ para docs del proyecto | **No.** Docs-as-code (Markdown en el repo, versionado con el código) es más profesional y **fuente única de verdad**; Notion la fragmenta. Para algo público, mejor un **sitio de docs** (abajo). Notion para tus notas personales, ok, pero no como integración del proyecto. |
| **n8n** (automatización no-code) | 🟡 más adelante | Útil para **ops** sin código (alertas, ETL de APIs externas, orquestar backups) y es self-hostable (encaja con Red Clara). Pero necesita servidor y, para un proyecto **científico/calling-card**, el pipeline core debe ser **código versionado/testeable** (agente + Functions), no flujos no-code. Opcional en Fase B. |
| **Slack** | 🟡 bajo | Somos ~solos. Valor real solo como **sink de alertas** (webhook) o **comunidad** si crece (ahí **Discord** es más estándar en open-source). Ciencia: in-app+email+FCM ya cubren. Dev: GitHub ya notifica. No ahora. |

### Lo que SÍ propongo (lo que de verdad eleva la calling card)
| Pieza | Por qué (qué faceta luce) | Costo |
|---|---|---|
| **Sitio de docs** (Nextra/Docusaurus/Mintlify) desde el Markdown del repo | Investigación + comunicación; se ve open-source-grade | gratis |
| **Storybook** (+ Chromatic opcional) para `packages/ui` | **Diseño/front-end**: catálogo vivo del design system = oro de portafolio | gratis |
| **Sentry** (o Crashlytics/Perf de Firebase) | **Full-stack/ops**: monitoreo de errores nivel producción | free tier |
| **GitHub polish**: Discussions, **CodeQL** (security scan), **Dependabot**, semantic-release, README con badges, board | El repo **mismo** como calling card; seguridad e ingeniería | gratis |
| **Playwright** E2E en CI | Rigor de ingeniería (cubre el E2E del MVP, doc 18 §6) | gratis |
| **Zenodo + DOI + CITATION.cff** (doc 17) | **Investigación**: citabilidad académica | gratis |
| **Status/uptime page** (opcional) | **Gestión de servidores**: profesionalismo operativo | gratis |
| **PostHog** (self-host, opcional) | Analítica de producto con ethos de autonomía | free/self-host |

> Resumen: **salta Notion**; n8n/Slack/Discord = ops/comunidad **para después**; invierte en
> **docs-site + Storybook + monitoreo + seguridad + DOI + E2E** → eso es lo que grita "ejemplar
> en todo, del frente hasta atrás".

---

## 3. Idea de landing capturada (para la sesión de diseño + Claude Design)

Alexander quiere las *vibes* del landing de **Antigravity**: un **campo de partículas reactivo al
cursor** que "perturba el espacio" alrededor. Adaptación a nuestro tema **Observatory**:
- Campo de **estrellas + trazas tenues de rayos cósmicos**; el cursor actúa como una **masa que
  curva/atrae las partículas cercanas** — guiño conceptual perfecto: **lente gravitacional** y
  "Antigravity" ↔ rayos cósmicos. Alternativa: el cursor **despeja una burbuja** en el campo.
- Implementación candidata: `react-three-fiber` (WebGL) o canvas 2D; respetar `prefers-reduced-motion`
  y rendimiento móvil. Solo en el **landing** (la app queda calma, doc DESIGN-LANGUAGE §7).
- **Estado: parking-lot.** Se desarrolla en la **próxima sesión de diseño con Claude Design**.
  Ver `docs/design/LANDING-CONCEPT.md`.

---

## 4. Decisiones propuestas (pendientes de confirmar)
- **D37 — Firebase-complete por defecto:** el producto corre completo sobre Firebase gratis; Red
  Clara/Supabase = upgrade opcional. Todo servicio detrás de nuestras interfaces (Auth/Storage/Data).
- **D38 — Filosofía de integraciones:** docs-as-code + sitio de docs; **no Notion**; n8n/Slack/Discord
  diferidos a ops/comunidad; invertir en Storybook + monitoreo + CodeQL + Playwright + DOI.
- **D39 — Firebase Auth (Fase A):** auth + roles vía **custom claims**, detrás de `AuthProvider`.

> Tras tu visto bueno, los registro en `00-MASTER-PLAN.md` y abro Issues para las piezas (docs-site,
> Storybook, Sentry, CodeQL, Auth spec).
