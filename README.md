# mon-miam-miam-projet_integrateur
Mon Miam Miam : application de commande de repas pour plusieurs restaurants (projet intégrateur)

## Démarrer

Prérequis : **Node.js 22.18 ou plus**.

```bash
# Serveur (API)
cd backend
cp .env.example .env     # puis adapter les valeurs (ce fichier n'est jamais publié)
npm install
npm test                 # lance les tests
npm run typecheck        # vérifie les types
npm run dev              # démarre l'API sur http://localhost:3000/api/health

# Site
cd frontend
npm install
npm test
npm run dev              # démarre le site sur http://localhost:5173
npm run build            # vérifie les types et construit la version de production
```

Les règles de travail (branches, commits, pull requests) sont dans [docs/conventions-git.md](docs/conventions-git.md). L'architecture visée est décrite dans `docs/architecture.md`.
