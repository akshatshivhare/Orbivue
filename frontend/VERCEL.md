# Vercel Deployment

Use these project settings for the public OrbiVue frontend deployment:

- Framework Preset: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Set this frontend environment variable in Vercel:

```text
VITE_API_BASE_URL=https://akshatshivhare--orbivue-backend-serve.modal.run
```

The frontend calls the public backend only. Backend and model provider secrets must stay out of Vercel frontend environment variables.
