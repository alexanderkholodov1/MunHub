# MunHub Lab v6.0 — Despliegue y Cutover del repo (GATED — no ejecutar sin aprobación)

> ⚠️ **Nada de esto se ejecuta hasta que Alexander lo apruebe explícitamente.** Documenta el
> estado real del despliegue y la secuencia segura para: pasar el despliegue de `munra-1`
> (viejo) a `munhub-1` (nuevo) desde `main`, arreglar el bug de la base de datos, redirigir el
> dominio viejo, y limpiar ramas. Alexander no es experto en Git → aquí va todo explicado y
> reversible.

---

## 1. Estado actual (verificado en el repo)

- **Ramas:**
  - `main` — actualmente dispara el despliegue automático de **munra-1** (config vieja).
  - `feature-spec-driven-development` — despliega **munhub-1.web.app** (pero usa la **DB de
    munra-1** — bug).
  - `architectural-redesign-v6` — rama actual con todo el plan v6 (esta).
- **`.firebaserc`** (en esta rama): `default = munhub-1`, `munra = munra-1`, `munhub = munhub-1`.
- **Workflow `.github/workflows/firebase-deploy.yml`:** en push a `main`/`master` corre
  `firebase deploy --only hosting` y `--only database` al **proyecto default**, con
  `secrets.FIREBASE_TOKEN`. PRs hacen deploy preview a un canal.
- **`config.js`:** `databaseURL` → `munhub-1-default-rtdb`, **pero `apiKey`/`senderId`/`appId`
  son placeholders** `REPLACE_WITH_MUNHUB1_*` → la app no se conecta de verdad a munhub-1 aún.
- **Hosting site:** sin campo `site` en `firebase.json` → despliega al site por defecto del
  proyecto (`munhub-1.web.app`). Para servir en **`munhub-lab.web.app`** hace falta un **site
  `munhub-lab` dentro del proyecto munhub-1** + apuntar el deploy a ese site (target/`site`).

## 2. Estado objetivo

- `main` es la **única** rama de despliegue, y despliega a **munhub-1** (proyecto + DB + hosting).
- La app servida usa la **DB de munhub-1** (no munra-1). Bug resuelto.
- **`munra-1.web.app` redirige** automáticamente a **`munhub-lab.web.app`**.
- Rama `feature-spec-driven-development` **eliminada** tras el merge.
- Secretos (FIREBASE_TOKEN o, mejor, cuenta de servicio) con acceso a munhub-1.

## 3. Bug a arreglar: munhub-1 usando la DB de munra-1 — ✅ ARREGLADO (working tree)

Causa: `config.js` tenía claves placeholder y `storageBucket` incorrecto. **Hecho:** se
pusieron las **claves web reales de munhub-1** (obtenidas vía Firebase Management API con el
service account): `apiKey`, `messagingSenderId`, `appId`, y `storageBucket` corregido a
`munhub-1.firebasestorage.app`. `databaseURL` ya apuntaba a `munhub-1-default-rtdb`. (La apiKey
web es pública.) **Pendiente:** que Alexander commitee este cambio; al desplegar munhub-1 desde
`main`, la app usará su propia DB.

## 4. Secuencia de cutover (cuando se apruebe; reversible)

> Pre-requisito: tener las **claves web reales de munhub-1** (pendiente A2/setup).

1. **Backup primero (BLOQUEADO — acción de Alexander):** `munra-1` está **deshabilitada por
   cuota** (R1 confirmado) → primero **habilitar Blaze temporal con budget bajo en munra-1**,
   exportar el histórico v5 (Console *Export JSON*), guardar dump frío, luego volver a Spark.
   **No avanzar el cutover de datos sin este respaldo.**
2. **Arreglar config**: ✅ HECHO (claves reales de munhub-1 en `config.js`). Falta verificar en
   un deploy preview (canal de PR) que la app lee/escribe la **DB de munhub-1**.
3. **Hosting site `munhub-lab`**: crear el site `munhub-lab` en el proyecto munhub-1 y configurar
   el target/`site` en `firebase.json` para desplegar ahí (→ `munhub-lab.web.app`).
4. **Merge** `architectural-redesign-v6` → `main` (cuando el plan/u obra esté lista). A partir de
   aquí, push a `main` despliega a **munhub-1** (default), no a munra-1. Esto **pausa de hecho**
   el despliegue de munra-1 desde main.
5. **Redirect del dominio viejo**: desplegar a **munra-1** una config de hosting mínima con un
   **redirect catch-all** a `https://munhub-lab.web.app` (regla `redirects` en su `firebase.json`,
   301). Una sola vez; munra-1 queda solo como redirector.
6. **Limpiar ramas**: borrar `feature-spec-driven-development` (y confirmar que ninguna otra
   automatización despliega munra-1). 
7. **Secreto de CI**: confirmar que `FIREBASE_TOKEN`/cuenta de servicio tiene acceso a munhub-1;
   `firebase deploy` (token) está **deprecándose** → preferir **cuenta de servicio**
   (`FIREBASE_SERVICE_ACCOUNT`) + `w9jds/firebase-action` o el `firebase deploy` con
   `GOOGLE_APPLICATION_CREDENTIALS`. (Mejora a hacer en EPIC-0/S02.)

## 5. Rollback
- Mientras no se borre `feature-spec-driven-development` ni se modifique munra-1, todo es
  reversible: si algo falla, revertir el merge en `main` y re-desplegar la rama previa.
- El dump frío del paso 1 garantiza que ningún dato se pierde.

## 6. Relación con el plan
- Esto encaja en **EPIC-0 (S02 CI/CD)** + **EPIC-2 (S07/S08 migración munra-1→munhub-1)**.
- ⚠️ **GATE:** Alexander aprueba antes de tocar ramas, despliegues o dominios. El montaje de
  **GitHub Project/Issues/milestones** también espera su aprobación (tras cerrar el plan).
