# Miquel Blasco Boix

Web de ensayos y textos. Sitio estático, bilingüe (ES/EN), publicado con GitHub Pages en mikiblasco.github.io.

© Miquel Blasco Boix. Todos los derechos reservados / All rights reserved.

## Cómo se publica un texto

1. Se añade un archivo `.md` en `content/es/` o `content/en/` con este encabezado:

   ```
   ---
   title: Título
   slug: titulo-en-la-url
   date: AAAA-MM-DD
   summary: Una frase.
   translation: slug-de-la-otra-lengua   (opcional)
   ---
   ```

2. Se hace commit en `main`. GitHub construye la web, la publica y envía cada texto a archive.org.

Cada página muestra la huella SHA-256 del texto, que sirve para demostrar que no ha cambiado.

Los borradores no se suben a este repositorio, que es público.
