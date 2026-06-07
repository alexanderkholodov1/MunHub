# MunHub Lab v6.0 — Consola de Administración

> Depende de: `05`, `11`, `12`. Expande EPIC-8. Principio rector: **todo se gestiona desde la
> plataforma, sin tocar el código/servidor** (migrar datos, editar usuarios/estaciones,
> resolver errores). Ecosistema autosuficiente (D23). Página dedicada, solo `admin`.

---

## 1. Capacidades del admin global

**Usuarios**
- Crear, editar, **deshabilitar** y eliminar cuentas (con confirmación destructiva).
- Asignar/quitar roles, incluido **nombrar nuevos admins** e `institution_admin`.
- **Crear cuentas e instituciones en nombre de terceros** (para usuarios con baja
  alfabetización digital). Reset de contraseña / reenvío de verificación.

**Estaciones y detectores**
- Crear/editar/eliminar estaciones y detectores; **asignar/revocar permisos** (owner/editor/viewer).
- Cambiar visibilidad, reasignar dueño, mover estación entre instituciones.

**Datos / infraestructura (sin tocar el servidor)**
- Estadísticas de uso/almacenamiento; **migración entre proveedores** (Firebase↔Supabase);
  **importar DB externa desde archivo**; respaldos fríos y **restauración**; verificación de
  integridad. (Ya en EPIC-8/EPIC-9, accesible aquí.)

**Soporte y comunicación**
- Bandeja de **tickets** (responder, asignar, cerrar) — ver `12`.
- **Anuncios/broadcast** (avisos de mantenimiento/novedades).

**Sistema**
- **Feature flags / ajustes globales** (p. ej. activar/desactivar entrenamiento ML, registro
  abierto, modo mantenimiento).
- **Audit log** (ver §3).
- **Ver-como-usuario** (modo soporte para diagnosticar) — registrado en el audit log.
- Entitlements/metering (ver `13`) — observación, sin cobro.

## 2. Confirmaciones destructivas (estilo GitHub)
Toda acción irreversible (eliminar estación/usuario/institución, migrar/sobrescribir datos)
exige **escribir el nombre exacto del recurso** + un aviso claro de consecuencias. Donde sea
posible, **borrado suave (soft-delete) + respaldo previo** antes del borrado físico.

## 3. Audit log (seguridad y confianza)
- Registra: actor, acción, recurso, antes/después (resumen), timestamp, IP/sesión.
- Inmutable/append-only; consultable y exportable por el admin.
- Cubre acciones sensibles: cambios de rol/permiso, borrados, migraciones, ver-como-usuario,
  cambios de visibilidad, edición de calibración.

## 4. Onboarding wizard (para todos, incluso no técnicos)
- Asistente paso a paso: crear/unirse a institución → crear estación (con ayuda contextual)
  → registrar detector → conectar el agente. Con textos claros y enlaces a la documentación.
- El admin/`institution_admin` puede ejecutarlo **en nombre de** un usuario que lo necesite.

## 5. Backlog (ver `04`, EPIC-8 ampliada)
- Página admin dedicada · gestión usuarios/roles/instituciones · gestión estaciones/detectores
  · audit log · anuncios · feature flags · ver-como-usuario · bandeja de tickets · onboarding wizard.
