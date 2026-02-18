import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'fc26')]
    
    super_admins = await db.users.find({'role': 'super_admin'}).to_list(10)
    
    if super_admins:
        print(f"Username du Super Admin: {super_admins[0]['username']}")
    else:
        print("Aucun super admin trouvé")
    
    client.close()

asyncio.run(main())
