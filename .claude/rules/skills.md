# Skills installés dans le dépôt

Les fils de projet claude.ai ne chargent pas `.claude/skills/` tout seuls. Avant de
travailler sur un sujet ci-dessous, lis le `SKILL.md` indiqué (et ses références au besoin).

| Sujet | Fichier à lire |
| --- | --- |
| Supabase : Auth, RLS, Realtime, Edge Functions, migrations | `.claude/skills/supabase/SKILL.md` |
| SQL, index, RLS performante, verrous | `.claude/skills/supabase-postgres-best-practices/SKILL.md` |
| Composants React / Next.js, performance | `.claude/skills/vercel-react-best-practices/SKILL.md` |
| Relecture UI : accessibilité, tactile, mouvement réduit, i18n | `.claude/skills/web-design-guidelines/SKILL.md` |
| Nouvel écran ou refonte visuelle | `.claude/skills/frontend-design/SKILL.md` (toujours dans l'ambiance café de `CLAUDE.md`) |
| Tester l'app dans un navigateur (Playwright) | `.claude/skills/webapp-testing/SKILL.md` |

Vérification avant de dire qu'une étape est finie : `pnpm verify` (typecheck, tests, build).
La CI GitHub lance la même commande et un scan de secrets (gitleaks) sur chaque PR.

Mise à jour des skills : `DISABLE_TELEMETRY=1 npx skills@1.7.6 update -p -y`, puis relire le diff
(sources officielles seulement : supabase, vercel-labs, anthropics ; jamais d'annuaire tiers).
