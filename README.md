# ICOSIUM

Le café du coin, en ligne : jeux de société algériens entre amis, avec le vocal.

- Cahier des charges : [`docs/ICOSIUM.md`](docs/ICOSIUM.md)
- Avancement : [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Les 10 étapes du MVP : [`docs/etapes/`](docs/etapes/)
- Règles pour Claude Code : [`CLAUDE.md`](CLAUDE.md)

## Lancer ICOSIUM sur ton ordinateur

### 1. Installer les outils (une seule fois)

- [Node.js 22 LTS](https://nodejs.org/)
- pnpm : dans un terminal, tape `corepack enable`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), puis lance-le
- [Git](https://git-scm.com/)

### 2. Récupérer le code (une seule fois)

```bash
git clone https://github.com/Baghey/icosium.git
cd icosium
pnpm install
```

### 3. Créer le fichier `.env` (une seule fois)

```bash
copy .env.example .env        # Windows
cp .env.example .env          # Mac / Linux
```

Ouvre `.env` et :

1. remplace `ICOSIUM_LAN_IP` par l'adresse IP de ton ordinateur sur le Wi-Fi
   (Windows : tape `ipconfig` et prends la ligne « Adresse IPv4 », par exemple `192.168.1.23`) ;
2. remplace chaque `change-me-…` par une longue phrase de ton choix
   (`LIVEKIT_API_SECRET` doit faire au moins 32 caractères).

### 4. Lancer

Deux commandes, dans deux terminaux ouverts dans le dossier `icosium` :

```bash
pnpm infra:up   # lance les services (comptes, vocal, base de données)
pnpm dev        # lance l'app et le serveur de jeu ; laisse ce terminal ouvert
```

Pour tout arrêter : `Ctrl + C` dans le terminal de `pnpm dev`, puis `pnpm infra:down`.

### 5. Ouvrir l'app

- Sur l'ordinateur : <https://localhost:8443>
- Sur le téléphone (même Wi-Fi) : `https://<ton IP>:8443`, par exemple `https://192.168.1.23:8443`

Au premier accès, le navigateur affiche un avertissement de sécurité (certificat local) :
clique sur « Paramètres avancés » puis « Continuer vers le site ».

## Commandes utiles

| Commande | Ce qu'elle fait |
| --- | --- |
| `pnpm test` | Lance tous les tests |
| `pnpm typecheck` | Vérifie le TypeScript partout |
| `pnpm infra:logs` | Affiche les journaux des services |
| `pnpm infra:down` | Arrête les services |

Console d'administration Nakama : <http://localhost:7351> (identifiants dans `.env`).
