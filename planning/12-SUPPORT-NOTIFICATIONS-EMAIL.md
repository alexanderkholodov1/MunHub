# MunHub Lab v6.0 — Soporte, Notificaciones y Email

> Depende de: `10-OPERATIONS-AND-GOVERNANCE`. Hace el sistema **autosuficiente**: los usuarios
> abren tickets (no escriben al correo del admin), y el sistema avisa por sí mismo. Fase F5
> (con piezas de notificación antes). Principio D23: informativo y completo.

---

## 1. Sistema de tickets de soporte

- **Quién:** cualquier usuario autenticado (y opcionalmente invitados, con email + captcha).
- **Categorías:** Pregunta · Problema/Bug · Sugerencia · Agradecimiento/Feedback.
- **Metadatos automáticos adjuntos** (con consentimiento): usuario, rol, institución,
  estación/detector en contexto, versión del agente, navegador/SO, errores recientes del
  cliente, timestamp, idioma. Reduce el ida y vuelta.
- **Ciclo:** abierto → en progreso → esperando respuesta → resuelto → cerrado. Hilo de
  mensajes usuario↔admin, adjuntos (capturas).
- **Bandeja del admin** dentro de la consola (no email manual): filtrar por estado, categoría,
  institución; asignar, responder, cerrar.
- **FAQ pública** enlazada para desviar dudas comunes (reduce tickets).
- **Votación de sugerencias** (opcional, fase posterior): otros usuarios apoyan una idea.

## 2. Centro de notificaciones (in-app + email)

Un solo centro, con preferencias por canal (in-app / email) y por tipo:

| Evento | A quién | Canal sugerido |
|--------|---------|----------------|
| Actualización de tu ticket | usuario (y admin) | in-app + **email** |
| Detector caído / sin datos | dueño/editores | in-app + email |
| Gap de datos detectado | dueño | in-app |
| Anomalía / Forbush detectado | dueño + (red si aplica) | in-app + email |
| Recordatorio de metadatos incompletos | dueño | in-app (no intrusivo) |
| Invitación a compartir estación | invitado | in-app + email |
| Anuncio del sistema (mantenimiento) | todos | in-app (+ email si crítico) |
| Cambios de rol/permiso | afectado | in-app + email |

- **Preferencias por usuario:** silenciar tipos, elegir canal, frecuencia (inmediato/resumen diario).
- Internacionalizado (es/en/pt-BR).

## 3. Email transaccional (infraestructura)

Necesario para tickets y notificaciones. Requisito: **tier gratuito y billing-proof**.
- Opciones: **Brevo** (~300/día gratis), **Resend** (~3.000/mes gratis), o la extensión
  **"Trigger Email"** de Firebase con un SMTP gratuito. (Decisión técnica menor; elegir al implementar.)
- Plantillas versionadas, multi-idioma, con remitente verificado (SPF/DKIM del dominio).
- **Sin secretos en el repo:** API key del proveedor por variable de entorno.
- Manejar rebotes y opt-out de correos no esenciales (cumplir buenas prácticas anti-spam).

## 4. Modelo de datos (resumen; detalle en `02`)
- `support_tickets(id, user_uid, category, status, subject, context jsonb, created_at, updated_at)`
- `ticket_messages(id, ticket_id, author_uid, body, attachments, created_at)`
- `notifications(id, user_uid, type, payload jsonb, read_at, created_at)`
- `notification_prefs(user_uid, type, channel, frequency)`

## 5. Fase / prioridad
- Notificaciones in-app básicas: con el dashboard (F2).
- Email + tickets completos: F5 (consola admin).
