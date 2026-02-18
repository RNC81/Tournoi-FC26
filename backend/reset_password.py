import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import os

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_password(username: str, new_password: str):
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'fc26')]
    
    # Vérifier que l'utilisateur existe
    user = await db.users.find_one({'username': username})
    if not user:
        print(f"❌ Utilisateur '{username}' introuvable")
        client.close()
        return
    
    # Hasher le nouveau mot de passe
    hashed_password = pwd_context.hash(new_password)
    
    # Mettre à jour le mot de passe
    await db.users.update_one(
        {'username': username},
        {'$set': {'hashed_password': hashed_password}}
    )
    
    print(f"✅ Mot de passe réinitialisé pour '{username}'")
    print(f"   Nouveau mot de passe: {new_password}")
    
    client.close()

if __name__ == "__main__":
    # CHANGE CE MOT DE PASSE ICI
    NEW_PASSWORD = "admin123"  # ← Modifie cette valeur
    
    print(f"\n🔄 Réinitialisation du mot de passe pour 'test'...")
    asyncio.run(reset_password("test", NEW_PASSWORD))
