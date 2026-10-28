# Pekacubos

Juego de cubos en primera persona de **Pekapro**: rompe bloques, recógelos y construye. Web (Vite + Three.js), funciona en móvil, iOS y PC, y como APK de Android (Capacitor).

**Jugar:** https://pekapro-lab.github.io/pekacubos/

## Novedades v2.0.0
- **Fabricación** con panel táctil (🎒 o tecla E): tablones, palos, mesa de trabajo, antorchas, horno, cubo, farol, carbón vegetal, cristal, ladrillo y carne asada. Algunas recetas piden tener cerca la mesa o el horno. Al romper césped se obtiene tierra.
- **Criaturas originales** hechas por código: el Pompón (pacífico, salta y deambula, suelta carne) y el Sombrajo (sale de noche en la oscuridad, persigue y hace daño, suelta carbón y se desvanece al sol). Se les puede golpear.
- **Vida** con gemas de vida, daño por caída, regeneración, comer carne, pantalla de muerte y reaparecer.
- **Agua que fluye** por niveles (1–7), cae por huecos y se seca sin fuente; se recoge y se pone con el cubo. Simulación limitada por tick.
- **Iluminación**: luz del cielo + antorchas y faroles, luz suave por vértice y oclusión ambiental horneadas en la malla; de noche está oscuro de verdad.
- **Altura del mundo 128** (antes 64): se puede construir hasta y=127; búfer de colocación para hacer pilares saltando; mantener «Poner» repite.
- **Rendimiento**: mallado y luz en Web Workers, una llamada de dibujo por criatura, calidad automática (baja resolución y distancia si va lento).
- Compatible con partidas guardadas de la v1.

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
npm run test:all   # build + tests Playwright (bloques, colisiones, táctil, guardado, rendimiento, fabricación, criaturas, agua, luz, torre, compatibilidad v1)
npm run build:apk  # web para Capacitor + sync Android
```
El APK firmado lo genera GitHub Actions al publicar una etiqueta `v*`.
