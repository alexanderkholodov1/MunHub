# MunHub Lab v6.0 — Permisos, Compartición y Roles

> Depende de: `02-DATA-MODEL`, `05-REDUNDANCY-AND-SECURITY`. Decisiones D8, D24, D25.
> Define el modelo de autorización completo de la plataforma. Lo aplica el agente de seguridad.

---

## 1. Dos capas ortogonales

1. **Rol de sistema** (quién eres en toda la plataforma):
   `admin` (global) · `institution_admin` (su institución) · `user` · `guest` (no autenticado/solo lectura pública).
2. **Permiso por estación** (qué puedes hacer en *esa* estación):
   `owner` · `editor` · `viewer`.

Ambas se combinan: p. ej. un `user` puede ser `owner` de su estación y `viewer` de otra compartida.

---

## 2. Visibilidad de una estación (D24)

| Nivel | Quién la lee |
|-------|--------------|
| **Pública** | Cualquiera (incl. invitados); aparece en el mapa del landing |
| **Institucional** | Miembros de la institución dueña (solo si la estación tiene institución) |
| **Privada** | Dueño + usuarios/instituciones con permiso explícito |

- Elección **obligatoria al crear, sin default** (D22). Cambiable luego por owner/admin.
- **Embargo** opcional: privada hasta una fecha → luego pública (para publicar paper primero).

---

## 3. Qué puede hacer cada permiso por estación

| Acción | viewer | editor | owner | institution_admin* | admin |
|--------|:--:|:--:|:--:|:--:|:--:|
| Ver datos y metadatos | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Escribir/ingerir datos** (agente) | — | ✓ | ✓ | ✓ | ✓ |
| Editar metadatos / calibración | — | ✓ | ✓ | ✓ | ✓ |
| Gestionar detectores (dispositivos) | — | ✓ | ✓ | ✓ | ✓ |
| Compartir / cambiar visibilidad | — | — | ✓ | ✓ | ✓ |
| Eliminar estación | — | — | ✓ (confirmación) | ✓ | ✓ |

\* `institution_admin` solo sobre estaciones de su institución.

> **Caso de uso resuelto (D-edit):** el `editor` **puede escribir datos** sobre la estación
> aunque sea desde otra máquina/agente (p. ej. el dueño no tiene el equipo a mano y un colega
> sube los datos). Se conecta con el aviso de device-token: si el aparato físico difiere,
> avisamos por consistencia pero permitimos.

---

## 4. Membresía e instituciones

- Un usuario puede pertenecer a **una institución** (o ninguna → independiente).
- `institution_admin` gestiona miembros y estaciones de su institución (no de otras).
- **Default institucional configurable:** una institución puede definir que sus estaciones
  nazcan con visibilidad `institucional` por defecto (sugerido, no impuesto).
- Unirse a una institución: por **invitación del institution_admin** o solicitud + aprobación
  (evita que cualquiera se autoadscriba a una universidad).

---

## 5. Identidad de usuario y compartición (D25)

Cada cuenta registra: **email** (único), **username** (único), **nombre para mostrar**, país,
idioma, institución (opcional), rol.

**Flujo de compartir una estación:**
- Buscar por **email exacto** (modo invitación) o por **username**; la UI muestra
  **nombre + institución** para confirmar que es la persona correcta.
- Alternativa: elegir de la **lista de miembros de tu institución**.
- Asignar permiso (`viewer`/`editor`).
- **Privacidad:** no se revela si un email existe (se "invita" igual); búsqueda libre por
  username solo si el usuario lo permite en sus ajustes (directorio opt-in).

---

## 6. Traducción a reglas técnicas

- **Fase A (Firebase rules):** validar visibilidad + grants (`station_shares`) +
  pertenencia institucional + rol de sistema. Deny-by-default.
- **Fase B (Postgres RLS):** una política por tabla/acción equivalente; el `editor` habilita
  `INSERT` en `minute_records`/`realtime_records` de esa estación.
- **Tests obligatorios:** casos **permitidos y denegados** (negativos) por cada combinación
  rol × permiso × visibilidad.

---

## 7. Pendiente de producto
- ¿El "directorio de usuarios" buscable por username es opt-in por defecto? (propuesta: sí, opt-in).
- ¿Una estación puede compartirse con **otra institución** completa, o solo con usuarios? (propuesta: ambos).
