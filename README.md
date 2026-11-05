# ICOSIUM

Le café du coin, en ligne : jeux de société algériens entre amis, avec le vocal.

- Cahier des charges : [`docs/ICOSIUM.md`](docs/ICOSIUM.md)
- Avancement : [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Les 10 étapes du MVP : [`docs/etapes/`](docs/etapes/)
- Règles pour Claude Code : [`CLAUDE.md`](CLAUDE.md)

## Comment ça tourne

| Brique | Service | Rôle |
| --- | --- | --- |
| App web (PWA) | Vercel | Les pages et les routes serveur (`apps/web`) |
| Comptes et base | Supabase (projet `icosium`, Paris) | Inscription, invités, profils, plus tard les parties et le chat |
| Vocal | LiveKit Cloud | Les salons audio |

**Le site : <https://icosium-rho.vercel.app>** — rien à installer, on l'ouvre sur l'ordinateur ou le téléphone.

## Mettre en ligne (une seule fois)

1. **Supabase** : déjà créé. Dans Authentication → Sign In / Providers, activer
   « Allow anonymous sign-ins » (mode invité).
2. **LiveKit Cloud** : créer un projet gratuit sur <https://cloud.livekit.io>, puis noter
   l'adresse `wss://…`, la clé et le secret (Settings → Keys).
3. **Vercel** : « Add New → Project », importer le dépôt GitHub `icosium`, mettre
   **Root Directory = `apps/web`**, et ajouter les variables de `.env.example`.
4. Dans Supabase → Authentication → URL Configuration, mettre l'adresse Vercel comme Site URL.

Chaque `git push` sur `main` remet automatiquement l'app à jour sur Vercel.

## Pour les développeurs (facultatif)

```bash
corepack enable
pnpm install
cp .env.example .env   # puis remplir les clés LiveKit
pnpm dev               # http://localhost:3000
pnpm test              # tous les tests
pnpm typecheck         # vérification TypeScript
```
