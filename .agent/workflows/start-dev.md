---
description: Checklist de lancement manuel de l'environnement de développement
---

# 🚀 Procédure de Lancement Manuel

Ce workflow est un guide pour lancer les 3 terminaux nécessaires au projet.
Tu dois t'assurer que chaque commande est lancée dans un terminal séparé.

## 1. Terminal Database (MongoDB)
- [ ] Ouvre un terminal à la racine du projet
- [ ] Lance la commande :
  ```powershell
  & "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath ./data/db
  ```
- [ ] **Vérification** : Le terminal doit afficher des logs et ne pas rendre la main.

## 2. Terminal Backend (FastAPI)
- [ ] Ouvre un nouveau terminal dans `backend/`
- [ ] Active l'environnement : `.\venv\Scripts\activate`
- [ ] Lance le serveur : `uvicorn server:app --reload`
- [ ] **Vérification** : Aller sur http://127.0.0.1:8000/docs (Doit afficher Swagger UI)

## 3. Terminal Frontend (React)
- [ ] Ouvre un nouveau terminal dans `frontend/`
- [ ] Lance le client : `npm start`
- [ ] **Vérification** : Le navigateur s'ouvre sur http://localhost:3000
