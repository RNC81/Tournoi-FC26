import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'fc26')]
    
    print("\n=== SUPER ADMIN(S) ===")
    super_admins = await db.users.find({'role': 'super_admin'}).to_list(10)
    for user in super_admins:
        print(f"  Username: {user['username']}")
        print(f"  Status: {user.get('status', 'N/A')}")
        print(f"  Created: {user.get('createdAt', 'N/A')}")
        print()
    
    print("\n=== ALL USERS ===")
    all_users = await db.users.find({}).to_list(100)
    for user in all_users:
        print(f"  - {user['username']} (role: {user.get('role', 'N/A')}, status: {user.get('status', 'N/A')})")
    
    client.close()

asyncio.run(main())
