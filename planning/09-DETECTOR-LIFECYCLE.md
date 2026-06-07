# MunHub Lab v6.0 — Ciclo de vida de Estaciones y Detectores

> Depende de: `01`, `02`, `05`, `docs/research/THEORETICAL-FOUNDATION.md`.
> Modelo de dos niveles (D21): **Estación** = perfil/sitio; **Detector** = dispositivo físico.
> Principio (D23): **máxima informatividad/configurabilidad/ajustabilidad**, sin estorbar el
> flujo básico. Afecta EPIC-3 (auth), EPIC-4 (agente) e integridad científica.

---

## 1. Etapas

```
Crear Estación → Registrar Detector(es) → Calibración → Operación → Mantenimiento → Baja
```

## 2. Crear Estación (en la web)

- El usuario crea la estación con sus **metadatos de sitio** (`02 §3`): nombre, ubicación
  (**lat/lon/altitud ingresados a mano**, sin geolocalización automática), ciudad/país,
  emplazamiento, `type` (single/coincidence), timezone.
- **Visibilidad = elección obligatoria, sin default** (público/privado/unlisted); opción de
  **embargo** (privado hasta una fecha → luego público).
- Compatibilidad CosmicWatch: no se le pide nada especial al hardware.

## 3. Registrar Detector(es) (dispositivo físico)

- Dentro de la estación se registra ≥1 Detector con: `hardware_model`, `firmware_version`,
  `hw_version` (v2/v3X → τ_DT), `sipm_count`.
- El sistema **genera un `device_token`** para el aparato — **sin ralentizar el registro**
  (transparente). Visible luego en los **ajustes avanzados/metadatos** del detector.
- **Emparejamiento del agente:** el agente Tauri se vincula iniciando sesión el dueño y
  eligiendo la estación/detector (o pegando un código). Guarda credenciales locales seguras y
  marca sus envíos con el `device_token`.
- **Auth de origen (D-auth):** Fase A → auth de usuario + reglas que validan permiso sobre la
  estación; el `device_token` se usa para **identidad/aviso de consistencia**. Fase B →
  refuerzo opcional con credencial por detector (RLS por dispositivo).

### Aviso de consistencia (multi-dispositivo)
Si llega data con un `device_token` distinto al registrado (edición compartida, o el dueño
conecta otro aparato al mismo Detector), la app **avisa fuerte**: *"No recomendamos mezclar
dispositivos: la calibración puede diferir y afectar la consistencia de los datos. Te
sugerimos crear un nuevo Detector/Estación."* Si el usuario continúa, el Detector queda con
varios aparatos registrados (todo trazable).

## 4. Calibración (qué es y alcance)

La plataforma **no calibra físicamente**; almacena constantes para que los cálculos sean
correctos. **Buena noticia:** el firmware CosmicWatch **ya entrega mV y dead time**, así que
en la práctica basta con la `hw_version` (para τ_DT). Aun así, por el principio D23:

- **Defaults por `hw_version`** aplicados automáticamente (cero fricción para el 99%).
- **Edición avanzada OPCIONAL** (en ajustes avanzados del detector): `adc_to_mv`,
  `saturation_mv` (~180–200 mV), `trigger_adc_min`, τ_DT override — para quien calibró su
  equipo con osciloscopio. Con botón **"volver a defaults"**.
- Los datos quedan marcados con la `calibration`/`model_version` vigente al capturarse
  (trazabilidad científica). Sin calibración válida → se reporta en crudo, marcado "sin calibrar".

## 5. Operación

- El agente: lee serial → **persiste en SQLite (capa 1)** → calcula derivados **en el borde**
  (promedios/min, corrección de tiempo muerto, validación) → sincroniza vía `DataProvider`
  con cola offline idempotente (`01 §4`).
- La estación muestra estado **activo/inactivo** (alimenta el mapa del landing, S23, agregado
  por ciudad).

## 6. Mantenimiento

- **Auto-actualización del agente (D-update):** **automática en background**, firmada, se
  aplica al reiniciar y **nunca interrumpe la grabación ni pierde datos**.
- **Recalibración:** el usuario puede ajustar la calibración; trazable por `model_version`.
- **Reubicación/cambio de hardware:** actualizar metadatos (nueva altitud/emplazamiento cambia
  la física) → se marca un **nuevo tramo** para no mezclar regímenes; si cambia el aparato,
  registrar nuevo Detector.

## 7. Baja
- Estación/Detector se marca inactivo/archivado **sin borrar histórico** (retención
  indefinida). Borrado solo por admin, con respaldo previo (tombstone para datos públicos
  ya citados).

---

## 8. Decisiones (resueltas)
- ✅ Auth: usuario + registro manual; `device_token` desde F1 para identidad/aviso; refuerzo
  por detector en Fase B.
- ✅ Calibración: defaults por hardware + **edición avanzada opcional** + reset; guardar todos
  los metadatos (incl. firmware).
- ✅ Auto-update: automático en background, sin interrumpir grabación.
- ✅ Visibilidad: elección obligatoria al crear la estación, sin default; embargo opcional.
