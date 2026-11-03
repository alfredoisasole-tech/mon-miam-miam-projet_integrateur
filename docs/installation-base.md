# Installation et sauvegarde de la base SQLite

L’API utilise SQLite dans un fichier local. En production, `DATABASE_PATH` doit pointer vers un disque persistant attaché au service API, par exemple `/var/data/mon-miam-miam.sqlite`. Ne placez pas la base dans le répertoire temporaire de l’application ou dans un volume qui disparaît au redémarrage.

## Créer ou mettre à jour la base

Depuis le dossier `backend`, définissez `DATABASE_PATH`, puis appliquez les migrations :

```bash
DATABASE_PATH=/var/data/mon-miam-miam.sqlite npm run migrate
```

Le dossier parent est créé si nécessaire. La commande est rejouable et n’applique que les migrations manquantes. Le démarrage de l’API applique également les migrations.

Pour vérifier une installation locale neuve :

```bash
DATABASE_PATH=./data/verification.sqlite npm run migrate
DATABASE_PATH=./data/verification.sqlite npm run seed
npm start
```

Le seed contient uniquement des comptes et données de démonstration. Ne l’exécutez pas sur une base de production avec de vraies données.

## Sauvegarder

Planifiez des sauvegardes régulières vers un emplacement séparé du disque de production et vérifiez périodiquement qu’elles peuvent être restaurées.

La méthode simple est une copie à froid : arrêtez l’API pour que SQLite ferme ses fichiers, copiez le fichier `.sqlite` vers un stockage de sauvegarde daté, puis redémarrez l’API.

```bash
cp /var/data/mon-miam-miam.sqlite /mnt/backups/mon-miam-miam-2026-11-03.sqlite
```

Avec l’API arrêtée, SQLite permet aussi de créer une copie cohérente :

```bash
sqlite3 /var/data/mon-miam-miam.sqlite ".backup '/mnt/backups/mon-miam-miam-2026-11-03.sqlite'"
```

Conservez les sauvegardes hors du disque qui héberge la base. Protégez-les comme des données de production : elles contiennent des informations personnelles et des empreintes de mots de passe.

## Restaurer

1. Arrêtez l’API afin qu’aucun processus n’écrive dans la base.
2. Conservez une copie de l’état courant avant de le remplacer.
3. Copiez la sauvegarde choisie vers le chemin configuré par `DATABASE_PATH`.
4. Vérifiez les droits de lecture et d’écriture du compte de service.
5. Lancez `npm run migrate` depuis `backend`, puis redémarrez l’API et vérifiez `GET /api/health` ainsi qu’une route métier avec un compte autorisé.

Ne lancez pas le seed pendant une restauration de données réelles. Après une restauration, les commandes, comptes et paiements créés depuis la date de la sauvegarde peuvent être absents; vérifiez l’état métier avant de rouvrir le service.

## Exemple PowerShell

Arrêtez d’abord le service qui utilise la base, puis adaptez les chemins :

```powershell
Copy-Item -LiteralPath 'D:\data\mon-miam-miam.sqlite' -Destination 'D:\backups\mon-miam-miam-2026-11-03.sqlite'
```

Pour restaurer, conservez l’ancienne base, puis copiez la sauvegarde vers le chemin défini par `DATABASE_PATH` avant de relancer les migrations et l’API.
