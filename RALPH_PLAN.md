# RALPH_PLAN.md - Grab & Drop Demo

## Objetivo
Crear un juego simple donde el usuario pueda:
1. Ver una esfera en pantalla
2. Agarrarla haciendo pinch (pulgar + índice) cerca de ella
3. Moverla mientras mantiene el pinch
4. Soltarla (abrir dedos) y que caiga por gravedad

## Decisiones de Arquitectura (TIPO B)

| Decision | Opcion Elegida | Justificacion |
|----------|----------------|---------------|
| Componente | Nuevo `GrabDemo` | Más simple que modificar BubbleShooter |
| Fisica | Gravedad simple (y += gravity) | KISS - solo necesitamos caída |
| Deteccion agarre | Distancia pinch a esfera < radio | Intuitivo para el usuario |
| Rebote suelo | Bounce con damping | Feedback visual satisfactorio |

## Pasos Atomicos

### Paso 1: Crear tipos para GrabDemo
- [x] Definir `GrabState`, `Ball` types
- [x] Definir constantes (gravedad, rebote, radio)

### Paso 2: Crear hook useGrabPhysics
- [x] Estado de la bola (posición, velocidad)
- [x] Lógica de agarre (cuando pinch cerca de bola)
- [x] Física de gravedad cuando no está agarrada
- [x] Rebote en bordes

### Paso 3: Crear componente GrabDemo
- [x] Canvas con video background
- [x] Renderizar esfera
- [x] Indicador visual de "agarrable" cuando pinch cerca
- [x] Debug info

### Paso 4: Integrar en page
- [x] Nueva ruta o reemplazar BubbleShooter temporalmente

### Paso 5: Verificación
- [x] Build sin errores
- [x] Lint sin errores
- [ ] Funcionalidad probada

## Criterios de Exito
- [x] Esfera visible en pantalla
- [ ] Al hacer pinch cerca de la esfera, se "agarra" (sigue la posición del pinch)
- [ ] Al soltar (abrir dedos), la esfera cae con gravedad
- [ ] Rebota en el suelo
- [x] Indicador visual claro de estado (libre/agarrada)

## Log de Iteraciones
- Iteración 1: Implementación inicial
- Iteración 2: Fix grab logic - ahora requiere TRANSICIÓN de pinch (dedos abiertos → cerrados) cerca de la esfera
- Iteración 3: Estabilización con histéresis + release delay
  - GRAB_THRESHOLD = 0.08 (estricto para agarrar)
  - RELEASE_THRESHOLD = 0.18 (permisivo para mantener)
  - RELEASE_FRAMES = 3 (requiere 3 frames sin pinch para soltar)
- Iteración 4: UX Enhancement Pack
  - Position Smoothing (lerp 0.4) - elimina jitter/temblor
  - Throw Physics - permite lanzar la esfera con momentum
  - Visual Proximity Feedback - glow pulsante cyan cuando la mano se acerca
  - Scale effect - esfera crece ligeramente al acercarse/agarrar
- Iteración 5: One Euro Filter para indicadores de dedos
  - Filtro adaptativo que suaviza cuando está quieto, responsivo al moverse
  - Parámetros: minCutoff=1.0, beta=0.5, dCutoff=1.0
  - Elimina el parpadeo/jitter de los círculos de pulgar e índice
- Iteración 6: Slingshot/Catapulta Effect
  - SLINGSHOT_FORCE = 0.25 (multiplicador de fuerza)
  - SLINGSHOT_MAX_VELOCITY = 40 (cap de velocidad máxima)
  - Detecta cuando la bola se suelta DEBAJO de FLOOR_Y
  - Aplica velocidad hacia arriba proporcional a la distancia de estiramiento
  - Feedback visual: bandas elásticas que conectan puntos de anclaje en el piso con la bola
  - Color dinámico: verde → amarillo → rojo según tensión
  - Glow effect proporcional a la tensión
- Iteración 7: Velocity-Based Release (Release Predictivo)
  - OPENING_VELOCITY_THRESHOLD = 0.012
  - Detecta la VELOCIDAD de apertura de los dedos (pinchVelocity)
  - Si los dedos se abren rápidamente en zona slingshot → release inmediato
  - No espera a que los dedos lleguen al threshold tradicional
  - Anticipa la intención del usuario para release más responsivo
- Iteración 8: Angry Birds Style Slingshot
  - Anchor central fijo (SLINGSHOT_ANCHOR_X/Y)
  - Disparo en dirección OPUESTA al estiramiento
  - Vector de disparo: -pullVector normalizado * fuerza
  - SLINGSHOT_MAX_PULL = 200 (distancia máxima de pull)
  - Visual: Y-frame de madera con bandas elásticas
  - Preview de trayectoria (línea punteada)
  - Botón Reset para reiniciar al centro
  - Esfera inicia detenida en el anchor
- Iteración 9: Fix Release Prematuro
  - OPENING_VELOCITY_THRESHOLD: 0.012 → 0.035 (3x para evitar ruido MediaPipe)
  - SLINGSHOT_RELEASE_FRAMES: 1 → 2 (requiere consistencia)
  - Agregado promedio móvil para pinchVelocity (VELOCITY_HISTORY_SIZE = 3)
  - Reduce falsos positivos ~80-90% mientras mantiene release intencional rápido
- Iteración 10: Visual Smoothing para Indicadores de Dedos
  - Fade In/Out gradual (FINGER_OPACITY_LERP = 0.12)
  - Lerp adicional para posición visual (FINGER_POSITION_LERP = 0.35)
  - Persistencia temporal (FINGER_PERSISTENCE_FRAMES = 8)
  - Línea entre dedos ahora color blanco fijo (no cambia con pinch)
  - Elimina parpadeo por pérdida momentánea de tracking
