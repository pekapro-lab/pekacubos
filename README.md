# Pekacubos

Juego de cubos en primera persona de **Pekapro**: rompe bloques, recógelos y construye. Web (Vite + Three.js), funciona en móvil, iOS y PC, y como APK de Android (Capacitor).

**Jugar:** https://pekapro-lab.github.io/pekacubos/

## Funciones (v1.0.0)
- Mundo infinito por chunks de 16×16×64 con terreno procedural (ruido): césped, tierra, piedra, arena, agua, árboles.
- Mallas por chunk solo con caras visibles; distancia de visión ajustable (2–8 chunks).
- Primera persona con brazo visible que se balancea al andar y anima al romper/poner.
- Romper (tiempo según el bloque, con grietas) y poner bloques; lo roto va al inventario; barra de 9 huecos.
- Andar, saltar, gravedad, nadar, colisiones propias (sin motor de físicas); ciclo día/noche.
- Táctil: joystick a la izquierda, arrastrar a la derecha para mirar, toque = poner, pulsación larga = romper, botones Saltar/Romper/Poner.
- PC: WASD, espacio, ratón con pointer lock, clic izq. rompe, clic der. pone, 1–9/rueda.
- Guardado automático en el navegador (localStorage).
- Todo generado por código: texturas pixel-art en canvas, sonidos con WebAudio, icono con Python/PIL.

## Desarrollo
```bash
npm ci
npm run dev        # servidor local
npm run test:all   # build + tests Playwright (bloques, colisiones, táctil, guardado, rendimiento)
npm run build:apk  # web para Capacitor + sync Android
```
El APK firmado lo genera GitHub Actions al publicar una etiqueta `v*`.
