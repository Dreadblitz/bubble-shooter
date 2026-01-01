# RALPH_PLAN - Bubble Shooter con MediaPipe

## Objetivo
Juego Bubble Shooter controlado con las manos usando MediaPipe. Mecánica de slingshot/catapulta con gesto Pinch & Pull.

## Decisiones del Usuario

| Aspecto | Elección |
|---------|----------|
| Mecánica | Pinch & Pull (índice + pulgar) |
| Visual | Neon/Cyberpunk |
| Modo | Endless/Survival |
| Features | Básico (Match-3, puntuación, game over) |

## Arquitectura

### Mecánica Pinch & Pull
1. Detectar pinch: distancia entre THUMB_TIP (4) e INDEX_TIP (8) < threshold
2. Si pinch sobre burbuja launcher → iniciar drag
3. Calcular vector de tiro: posición actual vs posición inicial del pinch
4. Al soltar (distancia > threshold) → lanzar con física de proyectil

### Grid de Burbujas
- Grid hexagonal (offset rows)
- 8 columnas, filas dinámicas
- 6 colores de burbujas
- Match-3+ del mismo color → pop

### Física
- Gravedad: 0 (las burbujas flotan)
- Colisiones con paredes (rebote)
- Colisión con grid → snap a posición más cercana
- Detección de matches después de cada snap

### Modo Endless
- Cada N segundos, nueva fila de burbujas aparece arriba
- Todas las filas bajan una posición
- Game Over: si alguna burbuja cruza la línea inferior

## Stack Técnico
- Base: mediapipe-hand-demo existente
- Canvas 2D para renderizado del juego
- RequestAnimationFrame para game loop
- Sin dependencias adicionales

## Tareas Atómicas

### FASE 1 - Estructura
- [ ] Crear carpeta `/src/game/`
- [ ] Definir tipos del juego (Bubble, GameState, etc.)
- [ ] Crear GameCanvas component

### FASE 1 - Gestos
- [ ] Hook usePinchGesture para detectar pinch
- [ ] Calcular posición del pinch en coordenadas del canvas
- [ ] Detectar inicio/fin de pinch para slingshot

### FASE 1 - Física Slingshot
- [ ] Clase Projectile para burbuja en vuelo
- [ ] Calcular velocidad basada en pull distance/direction
- [ ] Colisiones con paredes (rebote)
- [ ] Colisión con grid (snap)

### FASE 1 - Grid & Match-3
- [ ] Clase BubbleGrid para el grid hexagonal
- [ ] Algoritmo de match-3 (flood fill por color)
- [ ] Eliminar burbujas matcheadas
- [ ] Detectar burbujas flotantes (sin conexión arriba)

### FASE 1 - UI Neon
- [ ] Fondo oscuro con gradiente
- [ ] Burbujas con glow effect (shadowBlur)
- [ ] Línea de trayectoria predictiva
- [ ] HUD: Score, nivel de peligro
- [ ] Efectos de partículas al pop

### FASE 1 - Game Loop
- [ ] Estado: IDLE, AIMING, SHOOTING, GAME_OVER
- [ ] Spawner de nuevas filas cada N segundos
- [ ] Detección de game over
- [ ] Pantalla de game over con restart

## Criterios de Éxito

| Criterio | Métrica |
|----------|---------|
| Detección de pinch | Funciona consistentemente |
| Slingshot | Se siente natural y responsivo |
| Match-3 | Detecta correctamente grupos de 3+ |
| FPS | >= 30 FPS durante gameplay |
| Visual | Estética Neon coherente |

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Pinch detection impreciso | Threshold ajustable, feedback visual |
| Performance con muchas burbujas | Limitar a ~100 burbujas max |
| Física no intuitiva | Línea de trayectoria predictiva |

---
*Plan para Bubble Shooter - Ralph Protocol*
