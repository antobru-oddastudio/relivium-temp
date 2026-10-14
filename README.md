# relievum-proxy

Proxy che serve relievum.it senza X-Frame-Options/CSP e inietta `inject.js` in ogni pagina HTML.

## Locale

```sh
npm start   # http://localhost:3000
```

## Deploy su Render

Blueprint: su Render → **New → Blueprint** → seleziona il repo (usa `render.yaml`).

Oppure manuale, **New → Web Service**:
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`

La porta è letta da `PORT` (impostata da Render).
