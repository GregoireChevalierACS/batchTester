"""Bataille de dés : système externe écrit en Python.

Protocole (ADR 0003) : la première ligne écrite est la définition ; ensuite, pour chaque ligne
reçue {"id", "valeurs", "graine"}, une ligne {"id", "resultat"} ou {"id", "erreur"}.
Tout le hasard vient de random.Random(graine) : la même graine rejoue la même bataille.
"""

import json
import random
import sys

DEFINITION = {
    "nom": "Bataille de dés",
    "version": "1.0.0",
    "description": (
        "Chaque manche, l'attaquant et le défenseur lancent leurs dés ; les meilleurs dés sont "
        "comparés deux à deux et le perdant de chaque paire perd une armée."
    ),
    "parametres": [
        {"kind": "entier", "nom": "armeesAttaquant", "libelle": "Armées de l'attaquant",
         "min": 1, "max": 100, "defaut": 10},
        {"kind": "entier", "nom": "armeesDefenseur", "libelle": "Armées du défenseur",
         "min": 1, "max": 100, "defaut": 8},
        {"kind": "entier", "nom": "desAttaquant", "libelle": "Dés de l'attaquant",
         "min": 1, "max": 3, "defaut": 3},
        {"kind": "entier", "nom": "desDefenseur", "libelle": "Dés du défenseur",
         "min": 1, "max": 3, "defaut": 2},
        {"kind": "booleen", "nom": "egaliteAuDefenseur", "libelle": "Égalité au défenseur",
         "defaut": True},
        {"kind": "entier", "nom": "retraite", "libelle": "L'attaquant se retire à",
         "min": 0, "max": 50, "defaut": 1},
    ],
    "mesures": [
        {"kind": "categorie", "nom": "vainqueur", "libelle": "Vainqueur",
         "categories": ["attaquant", "defenseur"]},
        {"kind": "nombre", "nom": "manches", "libelle": "Durée", "unite": "manches"},
        {"kind": "nombre", "nom": "pertesAttaquant", "libelle": "Pertes de l'attaquant",
         "unite": "armées"},
        {"kind": "serie", "nom": "armeesAttaquant", "libelle": "Armées de l'attaquant par manche",
         "unite": "armées"},
        {"kind": "serie", "nom": "armeesDefenseur", "libelle": "Armées du défenseur par manche",
         "unite": "armées"},
    ],
}


def simuler(valeurs, graine):
    hasard = random.Random(graine)
    attaque = valeurs["armeesAttaquant"]
    defense = valeurs["armeesDefenseur"]
    historique_attaque, historique_defense = [attaque], [defense]
    manches = 0
    while defense > 0 and attaque > valeurs["retraite"]:
        manches += 1
        des_attaque = sorted(
            (hasard.randint(1, 6) for _ in range(min(valeurs["desAttaquant"], attaque))),
            reverse=True)
        des_defense = sorted(
            (hasard.randint(1, 6) for _ in range(min(valeurs["desDefenseur"], defense))),
            reverse=True)
        for a, d in zip(des_attaque, des_defense):
            if a > d or (a == d and not valeurs["egaliteAuDefenseur"]):
                defense -= 1
            else:
                attaque -= 1
        historique_attaque.append(attaque)
        historique_defense.append(defense)
    return {
        "vainqueur": "attaquant" if defense == 0 else "defenseur",
        "manches": manches,
        "pertesAttaquant": valeurs["armeesAttaquant"] - attaque,
        "armeesAttaquant": historique_attaque,
        "armeesDefenseur": historique_defense,
    }


def ecrire(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def main():
    ecrire({"definition": DEFINITION})
    for ligne in sys.stdin:
        demande = json.loads(ligne)
        try:
            ecrire({"id": demande["id"],
                    "resultat": simuler(demande["valeurs"], demande["graine"])})
        except Exception as erreur:  # noqa: BLE001 — toute panne est rapportée au moteur
            ecrire({"id": demande["id"], "erreur": f"{type(erreur).__name__} : {erreur}"})


if __name__ == "__main__":
    main()
