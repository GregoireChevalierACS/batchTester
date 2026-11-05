# ADR 0003 — Systèmes externes : un programme qui échange du JSON, une ligne par message

**Statut** : acceptée (2026-11-05)

## Contexte

Le cadre doit pouvoir tester des systèmes écrits dans n'importe quel langage, sans que leur auteur ait à écrire de TypeScript ni à se brancher sur une bibliothèque. Lancer un programme par itération serait trop lent (démarrer Python coûte des dizaines de millisecondes, un lot en compte des centaines).

## Décision

- Un système externe est un dossier de `systemes/` contenant `systeme.json` : `{ "commande": "python", "arguments": ["des.py"] }`. La commande est lancée **une fois**, dans ce dossier.
- Le programme et le moteur échangent sur l'entrée et la sortie standard, en JSON, **une ligne par message** :
  - au démarrage, le programme écrit sa définition : `{"definition": {...}}` (même forme qu'un système TypeScript) ;
  - pour chaque itération, le moteur écrit `{"id": 7, "valeurs": {...}, "graine": 123}` ;
  - le programme répond `{"id": 7, "resultat": {...}}`, ou `{"id": 7, "erreur": "..."}`.
- Les identifiants permettent plusieurs itérations en cours à la fois et des réponses dans le désordre. Une ligne qui n'est pas du JSON (une trace) est ignorée ; la sortie d'erreur sert à expliquer un arrêt.
- Le programme tire tout son hasard de la graine reçue. Rien ne le force à le faire, mais la suite de contrat, qui tourne sur tous les systèmes du dépôt, refuse un système qui ne redonne pas le même résultat pour la même graine.
- Au-delà de 10 s sans définition au démarrage, ou sans réponse à une itération, le programme est jugé bloqué.

## Conséquences

- Un système en Python, Lua, C#… tient en un fichier, sans dépendance ; l'exemple `systemes/des` en est un.
- Le résultat d'un programme externe passe par la même vérification que celui d'un système TypeScript (`verifierLeResultat`) : une mesure manquante ou mal typée est rapportée avec l'itération et sa graine.
- La reproductibilité dépend du générateur du langage (`random.Random(graine)` en Python) : la même graine redonne le même résultat avec la même version de l'interpréteur, pas forcément d'une version à l'autre.
- Le moteur garde le programme ouvert tant que le serveur tourne ; la ligne de commande l'arrête à la fin du lot.
