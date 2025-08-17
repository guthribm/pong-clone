# Deploying to GitHub Pages

This project is built with Vite. To publish to GitHub Pages as a project site, you need to set the Vite base to your repository path and publish the built `dist/` folder with `gh-pages`.

Quick one-liner (PowerShell, temporary for this session):

```powershell
$env:VITE_BASE = '/pong-clone/'; npm install; npm run deploy
```

Persistent (recommended): create `.env.production` in the project root with:

```
VITE_BASE=/pong-clone/
```

Then run:

```powershell
npm install
npm run deploy
```

Notes:

- `predeploy` runs the build and sets `VITE_BASE` using `cross-env` so `npm run deploy` should be sufficient.
- Ensure `VITE_BASE` includes leading and trailing slashes: `/your-repo-name/`.
- After publish, the site will be available at: `https://<your-username>.github.io/pong-clone/`.
