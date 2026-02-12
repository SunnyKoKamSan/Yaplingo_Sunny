#!/usr/bin/env python3
"""Quick debug script to check what types are returned by SQLModel queries"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from server.repository import Repository
from server.repository.models import User


async def main():
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            # Test different ways of querying
            print("Method 1: session.exec(select(User)).all()")
            result = await session.exec(select(User))
            users = result.all()
            print(f"  Type: {type(users)}")
            if users:
                row = users[0]
                print(f"  First item type: {type(row)}")
                print(f"  First item repr: {repr(row)}")
                print(f"  Trying to index row[0]...")
                try:
                    user = row[0]
                    print(f"  row[0] type: {type(user)}")
                    print(f"  row[0] name: {user.name}")
                except Exception as e:
                    print(f"  Error indexing: {e}")
    finally:
        await repo.dispose()


if __name__ == "__main__":
    asyncio.run(main())
