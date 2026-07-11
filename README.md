# Arga Battles — prototipo v0.1

Prototipo de combate por turnos hecho con HTML, CSS, JavaScript y Phaser 3.

## Probar localmente

Por seguridad del navegador, no abras `index.html` directamente. Inicia un servidor local dentro de la carpeta:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Publicar en GitHub Pages

1. Sube todos los archivos de esta carpeta a la raíz de un repositorio.
2. En GitHub entra en **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda y espera a que aparezca el enlace público.

## Contenido implementado

- Menú principal.
- Colocación libre de tres unidades en un tablero aliado 3×3.
- Campo completo de 6×3.
- Combate manual por turnos.
- Orden por Agilidad.
- 3 AP por turno.
- Movimiento ortogonal por 1 AP.
- Ataque frontal por 2 AP.
- Orientación visual derecha/izquierda.
- Panel de estadísticas al pulsar una unidad.
- IA que se mueve y ataca con las mismas reglas.
- Victoria, derrota y rondas infinitas con dificultad creciente.
- Reinicio de la run al perder.
- Placeholders preparados para habilidades y reliquias.

## Controles

1. En colocación, selecciona una tarjeta de unidad y pulsa una casilla verde.
2. En combate, usa los botones inferiores.
3. Para atacar, el enemigo debe estar en la casilla inmediatamente delante de la unidad.
4. Pulsa una unidad para consultar sus estadísticas.

## Cambios v0.1.1

- El ataque se confirma pulsando directamente al enemigo frontal o la casilla roja.
- Equipos aliados y enemigos generados al azar con repeticiones permitidas.
- Panel de estadísticas reorganizado y bendición mostrada con su icono.
- HUD inferior reajustado para evitar solapamientos.
- Menú principal simplificado.
