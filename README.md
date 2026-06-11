# 🎲 Daily Games

Mini-jeux de tirage au sort pour le Daily Scrum, à partager en visio. Quatre jeux « spectacle » de 10–30 secondes déterminent l'ordre de passage de l'équipe (ou tirent une personne au sort) :

- 🏁 **La Grande Course** — l'ordre d'arrivée fait l'ordre de passage
- 🎰 **Machine à sous** — le rouleau décide
- 🪙 **Plinko** — que la gravité décide (physique Matter.js)
- ⚔️ **Battle Royale** — le dernier debout est tiré au sort

## Fonctionnalités

- Deux modes : **ordre de passage complet** ou **une personne à la fois**
- Équipe persistante (localStorage) avec cases à cocher pour les absents du jour
- Écran résultat persistant : on coche chaque personne au fil du daily
- Anti-répétition légère : le « premier » d'hier ne ressort pas premier aujourd'hui
- Avatars générés (DiceBear, en local — déterministes à partir du nom)
- Effets sonores Web Audio avec bouton mute
- 100 % statique : **les noms ne quittent jamais le navigateur**

## Développement

```bash
npm install
npm run dev      # serveur local
npm run build    # build de production dans dist/
```

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et déploie `dist/` à chaque push sur `main`.

1. Créer un dépôt GitHub et pousser le projet
2. Dans *Settings → Pages*, choisir **Source : GitHub Actions**
3. L'app est servie sur `https://<user>.github.io/<repo>/`
