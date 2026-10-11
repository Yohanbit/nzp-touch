# NZP · Controles táctiles

Interfaz táctil experimental y no oficial para **Nazi Zombies: Portable**, de **NZ:P Team**. Este repositorio es una copia derivada del alojamiento web original; no es un juego nuevo ni una publicación oficial.

## Jugar

**https://yohanbit.github.io/nzp-touch/**

Abre el enlace en un navegador compatible, preferiblemente con el dispositivo en horizontal. El juego carga automáticamente. La primera carga descarga aproximadamente 100 MB; el sonido puede requerir un primer toque en la pantalla.

Los menús originales se manejan por toque o con las flechas y **✓**. Para volver entre submenús, utiliza la opción **BACK** del juego.

## Controles

- **Joystick izquierdo:** movimiento analógico. Llévalo arriba del todo un instante para bloquear el avance y solicitar carrera; puedes soltar el dedo. Tócalo de nuevo para detenerte o retomar el control manual.
- **Zona derecha:** desliza para mirar.
- **Disparo:** mantén pulsado; arrastra sobre el mismo botón para mirar mientras disparas.
- **Mira:** activación por toque o pulsación mantenida, según los ajustes.
- **Mano:** mantén para interactuar, comprar, reparar o abrir según el contexto.
- **Granada:** mantén para preparar y suelta para lanzar.
- Botones de recarga, salto, postura, cambio de arma y ataque cuerpo a cuerpo.

Apuntar, disparar, interactuar y otras acciones incompatibles cancelan la carrera automática. Abrir el menú, perder el foco o cancelar un toque también libera las entradas. Se conservan la resistencia y las restricciones de carrera del juego original.

En **Ajustes** puedes cambiar la sensibilidad normal y con mira, el tamaño y la opacidad de los botones, activar la distribución para zurdos, mostrar nombres, habilitar vibración y mover los botones. La configuración se guarda en el navegador cuando está disponible.

El HUD original sigue mostrando la munición, los puntos y el estado de la partida.

## Estado y rendimiento

La versión 3 sincroniza el renderizado con la pantalla y ajusta el lienzo al espacio disponible, incluida la rotación y la pantalla completa. Los archivos originales del motor, los mapas, las texturas y los paquetes del juego permanecen sin modificar.

La versión 3 pasó 30 comprobaciones automatizadas en Chromium, tanto localmente como desde el enlace público: arranque del motor y del mapa mediante los menús, carrera bloqueada, cancelaciones, entradas táctiles, sincronización y dimensiones del lienzo.

Estas pruebas **no garantizan una tasa concreta de FPS, la ausencia de errores gráficos en todos los dispositivos ni cada resultado del gameplay**. El rendimiento depende del navegador y del dispositivo. El cooperativo de esta versión todavía no se ha verificado.

## Créditos y licencias

Juego y recursos originales: **NZ:P Team y sus colaboradores acreditados**. El motor, la lógica del juego, los mapas y los recursos no fueron creados por el desarrollador de esta interfaz táctil.

- [Alojamiento web original y binarios precompilados](https://github.com/nzp-team/nzp-team.github.io)
- [Código del motor](https://github.com/nzp-team/fteqw)
- [Código de la lógica del juego](https://github.com/nzp-team/quakec)
- [Recursos y sus licencias](https://github.com/nzp-team/assets)
- [Documentación](https://docs.nzp.gay/)

Los avisos incluidos se encuentran en `licenses/attributions.txt`, `licenses/fteqw-gpl.txt`, `licenses/gpl-2.0.txt` y `licenses/cc-by-sa-4.0.txt`. Se mantienen los avisos originales dentro de los paquetes y las licencias particulares de cada recurso.

La interfaz añadida —`index.html`, `touch.css` y `touch.js`— se distribuye bajo **GPL-2.0-or-later**, sin garantía.

Los binarios del motor y del juego se heredan sin modificar del alojamiento oficial; no se recompilaron para esta interfaz. Las revisiones consultadas fueron `f68a2b547d2dc4bf6886b922baa1bff487cc5038` para el motor y `8a77f1ce45f1a2b9aa0afb301446954fda40e696` para la lógica del juego. No se ha certificado que sean las fuentes correspondientes exactas de todos los binarios heredados ni que permitan una compilación reproducible de ellos.

## Alojamiento

Requiere alojamiento estático HTTPS compatible con WebAssembly. Deben conservarse las rutas del motor y los paquetes de `nzp/`.

**GitHub Pages publica el cliente web; no proporciona un servidor cooperativo.**
