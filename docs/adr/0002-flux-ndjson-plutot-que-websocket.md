# ADR 0002 — Lots lancés par une requête HTTP en flux NDJSON, plutôt que par WebSocket

**Statut** : acceptée (2026-11-03)

## Contexte

L'interface relance un lot à chaque réglage et doit afficher sa progression, puis son résumé. Un réglage qui change pendant un lot rend ce lot inutile : il faut l'arrêter, pas seulement ignorer son résultat. La feuille de route prévoyait un WebSocket.

## Décision

- Un lot = une requête `POST /api/lots`. Le serveur répond au fil de l'eau, une ligne JSON par événement (`application/x-ndjson`) : des progressions, puis le résumé ou le problème.
- L'interface lit ce flux avec `fetch`. Quand un réglage change, elle abandonne la requête (`AbortController`) ; le serveur voit la connexion se fermer et annule le lot (`signal` du runner).
- Un système synchrone rend la main à la boucle d'événements toutes les 20 itérations (`simulateurQuiCede`), sans quoi le serveur ne verrait ni l'abandon ni l'occasion d'envoyer la progression avant la fin du lot.

## Conséquences

- Pas de protocole à part ni de dépendance WebSocket : une requête, un lot, une annulation.
- La même API se teste avec `fastify.inject` et se lit avec `curl`.
- Les échanges restent dans un seul sens (serveur vers interface) : si un jour l'interface doit piloter un lot en cours (pause, pas à pas), un WebSocket redeviendra pertinent.
