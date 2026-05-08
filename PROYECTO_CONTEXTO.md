# AnkiPlus — Documento de Contexto para Claude Code

## Qué es este proyecto

Aplicación personal de flashcards con repetición espaciada, similar a Anki pero con mejor UX, animaciones, sistema de racha y soporte para múltiples tipos de pregunta. Uso personal inicialmente, con arquitectura limpia para escalar a multi-usuario en el futuro.

---

## Stack técnico

- **Frontend:** React + Vite + TypeScript
- **Estilos:** Tailwind CSS
- **Estado global:** Zustand
- **Base de datos:** Supabase (PostgreSQL)
- **Almacenamiento de imágenes:** Supabase Storage
- **Offline/cache local:** IndexedDB (via idb)
- **Deploy:** Vercel (PWA)
- **Algoritmo de repetición:** SM-2 modificado

La app es una PWA (Progressive Web App) — una sola codebase que funciona en iPhone (Safari), Mac y PC sin publicar en App Store.

---

## Color y diseño

- **Color primario:** Púrpura `#534AB7`
- **Paleta de mazos:** Git = `#534AB7`, Programación = `#1D9E75`, Ing. Química = `#D85A30`
- **Código:** Terminal oscura `#1e1e2e` (Catppuccin Mocha)
- **Fuente monoespaciada para comandos:** JetBrains Mono o Fira Code
- **Modo oscuro:** soportado desde el inicio
- **Mobile-first:** diseñado para iPhone, luego adaptado a desktop

---

## Tipos de pregunta

Cada tarjeta tiene un `type` que determina cómo se renderiza:

1. **`flashcard`** — frente/reverso clásico con volteo animado. Autoevaluación manual.
2. **`multiple_choice`** — una o varias opciones correctas. Toggle de multi-select.
3. **`written`** — el usuario escribe la respuesta. Validación flexible (ignora mayúsculas, acepta respuestas alternativas).
4. **`fill_blank`** — comando con huecos para rellenar. Ej: `git ___ --hard HEAD~1`.
5. **`order_steps`** — pasos desordenados que el usuario arrastra al orden correcto.
6. **`match_pairs`** — dos columnas para emparejar (comando ↔ función).
7. **`true_false`** — afirmación + justificación al responder.
8. **`predict_output`** — muestra código/comando, el usuario predice el output.

---

## Modelo de datos (Supabase / PostgreSQL)

### Tabla: `decks`

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
description   text
color         text NOT NULL DEFAULT '#534AB7'
icon          text
daily_new_limit      int DEFAULT 10
max_repetition_days  int DEFAULT 180
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### Tabla: `tags`

```sql
id    uuid PRIMARY KEY DEFAULT gen_random_uuid()
name  text UNIQUE NOT NULL
color text NOT NULL DEFAULT '#534AB7'
```

### Tabla: `cards`

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
deck_id     uuid REFERENCES decks(id) ON DELETE CASCADE
type        text NOT NULL  -- enum: flashcard | multiple_choice | written | fill_blank | order_steps | match_pairs | true_false | predict_output
question    text NOT NULL
content     jsonb NOT NULL  -- estructura varía por type (ver abajo)
image_url   text
explanation text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

### Estructura JSONB de `content` por tipo

```typescript
// flashcard
{ back: string }

// multiple_choice
{ options: string[], correct: number[], multi_select: boolean }

// written
{ accepted_answers: string[], case_sensitive: boolean, flexible_order: boolean }

// fill_blank
{ template: string, blanks: Array<{ position: number, answer: string }> }

// order_steps
{ steps: string[], correct_order: number[] }

// match_pairs
{ left: string[], right: string[] }  // índice i de left → índice i de right

// true_false
{ answer: boolean, justification: string }

// predict_output
{ code: string, language: string, expected_output: string, flexible_match: boolean }
```

### Tabla: `card_tags`

```sql
card_id  uuid REFERENCES cards(id) ON DELETE CASCADE
tag_id   uuid REFERENCES tags(id) ON DELETE CASCADE
PRIMARY KEY (card_id, tag_id)
```

### Tabla: `card_progress`

```sql
card_id       uuid PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE
ease_factor   float DEFAULT 2.5
interval_days int DEFAULT 0
repetitions   int DEFAULT 0
next_review   date DEFAULT CURRENT_DATE
status        text DEFAULT 'new'  -- new | learning | review | suspended
```

### Tabla: `reviews`

```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
card_id          uuid REFERENCES cards(id) ON DELETE CASCADE
rating           int NOT NULL  -- 1=fallé, 2=difícil, 3=bien, 4=fácil
response_time_ms int
reviewed_at      timestamptz DEFAULT now()
```

### Tabla: `streaks`

```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
date           date UNIQUE NOT NULL
cards_reviewed int DEFAULT 0
minutes_studied int DEFAULT 0
```

### Tabla: `streak_freezes`

```sql
id       uuid PRIMARY KEY DEFAULT gen_random_uuid()
month    text NOT NULL  -- formato: '2026-05'
used_at  date NOT NULL
```

### Tabla: `settings`

```sql
key    text PRIMARY KEY
value  jsonb NOT NULL
```

Valores iniciales:

```json
{ "key": "streak_min_cards", "value": 10 }
{ "key": "streak_freezes_per_month", "value": 2 }
{ "key": "theme", "value": "dark" }
```

---

## Algoritmo SM-2

Implementación estándar del algoritmo SM-2 modificado:

```typescript
function sm2(card: CardProgress, rating: 1 | 2 | 3 | 4): CardProgress {
  // rating: 1=fallé, 2=difícil, 3=bien, 4=fácil
  const q = rating - 1; // normalizar a 0-3

  let { ease_factor, interval_days, repetitions } = card;

  if (q < 2) {
    // Falló — reiniciar
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);

    repetitions += 1;
  }

  // Ajustar ease factor
  ease_factor = Math.max(1.3, ease_factor + 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));

  // Aplicar límite máximo del mazo
  // (interval_days no debe superar deck.max_repetition_days)

  const next_review = addDays(new Date(), interval_days);
  const status = repetitions === 0 ? 'learning' : interval_days > 21 ? 'review' : 'learning';

  return { ...card, ease_factor, interval_days, repetitions, next_review, status };
}
```

---

## Sistema de racha

- La racha se **calcula** desde la tabla `streaks`, no se almacena como contador.
- Un día cuenta si `cards_reviewed >= settings.streak_min_cards` (default: 10).
- Los escudos (`streak_freezes`) permiten saltar días sin romper la racha.
- La mejor racha se calcula con una query sobre todos los días en `streaks`.
- Al completar una sesión, se hace upsert en `streaks` para el día actual.

```typescript
// Calcular racha actual
function calculateStreak(streakDays: Date[], freezes: Date[]): number {
  // Contar días consecutivos hacia atrás desde hoy
  // Los días en freezes cuentan como si hubieran estudiado
}
```

---

## Estructura de pantallas

### 1. Home (`/`)

- Racha actual prominente con animación de fuego
- Mejor racha personal
- Contador de escudos disponibles
- "A X días del récord" (motivación)
- Métricas: tarjetas pendientes hoy, % acierto hoy
- Lista de mazos con pendientes por mazo
- Botón principal "Estudiar todo (N tarjetas)"
- Heatmap de actividad (últimos 91 días, tipo GitHub)
- Navbar inferior: Inicio | Mazos | Stats | Config

### 2. Sesión de estudio (`/study?deck=id`)

- Barra de progreso superior (tarjeta N de M)
- Nombre del mazo
- Badge del tipo de pregunta
- Contenido central según el tipo (ver tipos arriba)
- Botón de confirmar/voltear
- Después de responder: feedback animado (correcto/incorrecto) + explicación + 4 botones de autoevaluación (Fallé/Difícil/Bien/Fácil) con el intervalo resultante visible
- Al terminar: pantalla de resumen con stats de la sesión

### 3. Lista de mazos (`/decks`)

- Grid de mazos con color, ícono, nombre, tarjetas pendientes
- Botón para crear nuevo mazo
- Tap en mazo → lista de tarjetas del mazo

### 4. Editor de tarjetas (`/decks/:id/cards/new` y `/cards/:id/edit`)

- Selector de mazo
- Grid de 8 tipos de pregunta (íconos)
- Formulario dinámico según el tipo seleccionado
- Campo de pregunta (texto)
- Campos específicos del tipo (opciones, respuestas, pasos, etc.)
- Campo de explicación opcional
- Upload de imagen opcional (Supabase Storage)
- Tags con selector

### 5. Estadísticas (`/stats`)

- 4 métricas globales: total revisadas, % acierto global, tiempo promedio, tarjetas activas
- Gráfica de barras: revisiones por día (última semana)
- Barras de progreso: % acierto por mazo
- Lista top 10 tarjetas más falladas con quick action "Estudiar ahora"
- Insight automático: mazo más débil

### 6. Configuración (`/settings`)

- Estudio: tarjetas nuevas/día, límite de repetición, timer on/off
- Racha: mínimo de tarjetas, escudos por mes
- Apariencia: modo oscuro toggle, hora de recordatorio
- Datos: importar .apkg, exportar datos, estado de sync Supabase

---

## Estructura de carpetas sugerida

```
src/
├── components/
│   ├── cards/
│   │   ├── FlashCard.tsx
│   │   ├── MultipleChoice.tsx
│   │   ├── WrittenAnswer.tsx
│   │   ├── FillBlank.tsx
│   │   ├── OrderSteps.tsx
│   │   ├── MatchPairs.tsx
│   │   ├── TrueFalse.tsx
│   │   └── PredictOutput.tsx
│   ├── study/
│   │   ├── StudySession.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── RatingButtons.tsx
│   │   ├── AnswerFeedback.tsx
│   │   └── SessionSummary.tsx
│   ├── home/
│   │   ├── StreakCard.tsx
│   │   ├── ActivityHeatmap.tsx
│   │   └── DeckList.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       └── Toggle.tsx
├── pages/
│   ├── Home.tsx
│   ├── Decks.tsx
│   ├── Study.tsx
│   ├── CardEditor.tsx
│   ├── Stats.tsx
│   └── Settings.tsx
├── store/
│   ├── useDecksStore.ts
│   ├── useStudyStore.ts
│   ├── useStreakStore.ts
│   └── useSettingsStore.ts
├── lib/
│   ├── supabase.ts
│   ├── sm2.ts
│   ├── streak.ts
│   └── indexeddb.ts
├── types/
│   └── index.ts
└── hooks/
    ├── useStudySession.ts
    ├── useStreak.ts
    └── useSync.ts
```

---

## MVP — Scope mínimo para empezar a estudiar

Construir en este orden:

1. Setup: Vite + React + TypeScript + Tailwind + Supabase + Zustand
2. Tablas de Supabase (ejecutar migrations)
3. Tipos TypeScript alineados con el modelo de datos
4. Componente `FlashCard` (volteo con animación CSS 3D)
5. Componente `MultipleChoice`
6. Componente `WrittenAnswer` con terminal oscura
7. Pantalla `Home` con racha, mazos pendientes, heatmap
8. Pantalla `Study` con progreso, feedback y autoevaluación
9. Algoritmo SM-2 en `lib/sm2.ts`
10. Sistema de racha en `lib/streak.ts`
11. Editor básico de tarjetas (flashcard + múltiple choice + escrita)
12. Configuración PWA (manifest + service worker)

---

## Notas importantes

- **Sin auth por ahora.** Un solo usuario. Sin login, sin registro.
- **Sync simple:** local primero, sync con Supabase en background. Last-write-wins.
- **Las imágenes** van a Supabase Storage bucket `card-images`. La URL firmada se guarda en `cards.image_url`.
- **El código en tarjetas** siempre usa `font-family: 'JetBrains Mono', monospace` y background `#1e1e2e`.
- **Los comandos de git/bash** en respuesta escrita tienen validación flexible: trim, lowercase, múltiples respuestas aceptadas.
- **La racha mínima** es configurable (default 10 tarjetas). Si el usuario estudia menos, el día no cuenta para la racha.
- **Animaciones clave:**
  - Volteo de flashcard: CSS `transform: rotateY(180deg)` con `transform-style: preserve-3d`
  - Feedback correcto: verde con checkmark + pequeño bounce
  - Feedback incorrecto: rojo con X + shake
  - Racha: número con efecto de fuego (emoji 🔥 + contador animado)
