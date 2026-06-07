# MunHub Lab v6.0 — Posicionamiento Académico, Atribución y Gobernanza

> Para que MunHub esté **listo para ser anunciado** en la comunidad científica, con atribución
> correcta a Alexander Kholodov (clave para su carrera investigadora) y siguiendo las mejores
> prácticas de **ciencia abierta**. Incluye lo legal/académico/"burocrático" en orden.
> Alexander es nuevo en investigación → aquí van los estándares explicados + acciones concretas.

---

## 1. Autoría y atribución (lo más importante para tu carrera)

- **Creador y desarrollador principal:** Alexander Kholodov (USFQ). Debe quedar registrado de
  forma inequívoca y citable.
- **Supervisor / investigador responsable (PI):** Dennis Cazar (LEOPARD, USFQ).
- **Marco:** proyecto EL-BONGO, Erasmus+ CBHE (financiado por la UE); USFQ; laboratorio LEOPARD.
- **Cómo se materializa en el repo y la plataforma:**
  - `CITATION.cff` (formato estándar de GitHub) → genera "Citar este repositorio" automáticamente.
  - `AUTHORS.md` + créditos claros en el `README` y en el **footer/Acerca de** de la plataforma.
  - Acknowledgments de financiamiento (Erasmus+/EU CBHE, USFQ, LEOPARD) en README y papers.

## 2. Identificadores persistentes (estándar de investigador)

- **ORCID:** Alexander debe **crear su ORCID iD** (gratis, 5 min, orcid.org) → identificador
  único de investigador. Enlazarlo en: perfil de la plataforma, `CITATION.cff`, repo, y papers.
  (También útil: ORCID-login opcional para investigadores en la plataforma — futuro.)
- **DOI del software (citable):** integrar **GitHub ↔ Zenodo** → cada *release* etiquetado
  obtiene un **DOI**. Así el software MunHub se cita formalmente (con tu nombre como autor).
- **DOI de datasets:** los datos públicos pueden recibir DOI (S68) → las instituciones citan los
  datos de la red (y a ti como creador de la plataforma).

## 3. Licencias (ya decididas, aquí en contexto académico)

- **Código:** MIT (D14) — máxima adopción, requiere conservar el aviso de copyright (tu crédito).
- **Datos públicos:** CC-BY 4.0 (D19) — reutilizables **con atribución obligatoria**.

## 4. Publicación científica (camino recomendado)

- **Preprint primero:** subir a **arXiv** (establece prioridad/fecha, gratis, citable) cuando el
  sistema y/o los primeros datos estén listos.
- **Revista para el SOFTWARE:** **JOSS** (Journal of Open Source Software) — ideal y diseñado
  para software científico open source como MunHub; revisión por pares enfocada en el software.
- **Revista para la CIENCIA/instrumento:** opciones según resultados — p. ej. *JINST*,
  *Rev. Sci. Instrum.*, *EPJ Plus*, o *The Physics Teacher* (vertiente educativa). El físico
  + tutor eligen el venue según el aporte.
- Base teórica ya lista (`docs/research/THEORETICAL-FOUNDATION.md`) → insumo del paper (EPIC-12 S48).

## 5. Estándares de ciencia abierta (checklist FAIR-ish)

- ✅ Código abierto (MIT) · ✅ Datos abiertos (CC-BY) · ✅ Documentación (EPIC-12).
- **Versionado semántico** (vX.Y.Z) + `CHANGELOG.md` + *releases* etiquetados.
- **Reproducibilidad:** README con pasos de despliegue (Firebase y Red Clara), datos de ejemplo.
- **DOIs + ORCID** (arriba). **Datos FAIR** (Findable, Accessible, Interoperable, Reusable):
  metadatos ricos por estación (¡ya en el modelo!), formatos abiertos (CSV/JSON), API pública (S67).

## 6. Gobernanza de contribuciones (al sumarse universidades)

- `CONTRIBUTING.md` (cómo contribuir, flujo SDD) + `CODE_OF_CONDUCT.md` (convivencia).
- Crédito a contribuidores (p. ej. all-contributors) sin diluir la autoría principal.
- Acuerdo simple de contribución (qué licencia aplica a los aportes externos).

## 7. Legal / institucional / "burocrático" (ACCIONES de Alexander, fuera del código)

> Esto NO lo resuelve un agente; son gestiones humanas. Listado para que esté en orden:

- [ ] **Crear ORCID iD.**
- [ ] **Clarificar la propiedad intelectual (IP) con la USFQ/Dennis**: el sistema lo creaste tú,
      bajo investigación de la USFQ y financiamiento Erasmus+. Conviene un **acuerdo/escrito**
      que reconozca tu autoría y tus derechos de uso para tu portafolio/carrera, y defina si la
      IP es tuya, compartida o institucional. **Hazlo temprano** (evita ambigüedad futura).
- [ ] **Obtener por escrito el reconocimiento de autoría** (tu tutor ya redactó una carta de
      aporte — guardarla; ampliarla si hace falta).
- [ ] **Confirmar requisitos de acknowledgment** del financiamiento Erasmus+/EU (suele exigir
      mención específica + logos en outputs).
- [ ] **Términos de Servicio + Política de Privacidad** de la plataforma (apoya `10-Gobernanza`;
      revisar con la USFQ antes del lanzamiento público).
- [ ] Definir el **nombre/identidad** oficial (MunHub Lab), logo, y si se registra de algún modo.

## 8. Presencia en la comunidad (a futuro, ir pensando)

- Landing público como cara del proyecto (F3) + un **whitepaper** corto.
- El paper + preprint + DOIs construyen tu **huella citable**.
- Presentar en conferencias/escuelas (EL-BONGO, LAGO, redes LatAm de física de partículas).
- La **red de estaciones** como recurso citable para otras universidades.

## 9. Decisiones a confirmar (cuando quieras)
- ¿Apuntamos a **JOSS** para el software + **arXiv** preprint? (recomendado).
- ¿Configuramos **Zenodo↔GitHub** para DOIs de releases desde el primer release?
- Postura de **IP** (a definir con la USFQ) — no la decide la IA.
