# MunHub Lab v6.0 — Monetización y Entitlements (solo diseño / ganchos)

> Decisión D26: **el núcleo es gratis siempre.** En v6.0 NO se implementa cobro; solo se
> dejan los **ganchos técnicos** (entitlements + metering) para habilitar tiers/cuotas/donaciones
> en el futuro **sin reescribir**. La decisión de negocio/legal la toma el humano + la universidad.

---

## 1. Principio

MunHub nace de una **misión de ciencia abierta** (Erasmus+/EU): adquirir, almacenar,
visualizar, analizar y unirse a la red debe ser **gratis para todos**, sin freemium que
interrumpa el trabajo de nadie. La monetización, si llega, **solo cubre costos de extras
caros**, nunca bloquea el núcleo.

## 2. Qué podría costar (futuro, opcional, alto costo marginal)

- **Cómputo ML intensivo bajo demanda** / entrenamiento de modelos a medida.
- **Cuota de API** por encima del tier gratuito (uso programático masivo).
- **Exportaciones masivas** / retención extendida de realtime de alta resolución.
- **Instancias privadas / white-label** para una institución (su propio despliegue + soporte).
- **Soporte/SLA institucional** (B2B; no afecta al usuario individual).

## 3. Sostenibilidad preferida (sin cobrar al usuario)
- **Donaciones** (botón "apoyar el proyecto").
- **Grants** y fondos de investigación.
- **Convenios/sponsorship institucional**.

## 4. Ganchos técnicos a construir AHORA (sin UI de cobro)

- **Modelo de plan/entitlements:** `plans(id, name, limits jsonb)` y
  `entitlements(subject_type[user|institution], subject_id, plan_id, valid_until)`.
  Por defecto **todos en plan "Open" (gratis) sin límites que estorben**.
- **Metering (medición de uso):** registrar uso de recursos caros (jobs ML, llamadas API,
  bytes exportados) en `usage_events`. Hoy solo informa/observa; mañana puede facturar.
- **Feature flags** ligados a entitlements (una función avanzada se activa por plan), todos
  encendidos en "Open" por ahora.
- **Cero pasarela de pago** en v6.0.

> Así, si algún día se decide cobrar, se añade una pasarela + se ajustan límites de planes,
> sin tocar el resto del sistema.

## 5. Realidad legal/pagos (para cuando se decida — fuera de alcance técnico v6)

- Requiere **entidad legal** (USFQ, una fundación, o registro personal) y cumplir
  facturación/impuestos de Ecuador + internacional.
- Pasarelas: verificar disponibilidad de payout en Ecuador (Stripe históricamente limitado;
  PayPal viable; o cobro vía la universidad). Métodos locales (tarjetas, transferencias).
- Cumplir leyes de protección de datos y términos de servicio (ver `10-Gobernanza`).
- **Recomendación:** no apurar; primero tracción y respaldo institucional.

## 6. Fase
- Esquema de entitlements/metering: F1 (parte del modelo de datos), sin UI de cobro.
- Pasarela/planes de pago: **fuera de v6.0** (módulo futuro).
