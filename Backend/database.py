from decouple import config
from motor.motor_asyncio import AsyncIOMotorClient


MONGODB_URL = config(
    "MONGO_URL",
    default=config("MONGODB_URL", default="mongodb://localhost:27017"),
)
DATABASE_NAME = config("DATABASE_NAME", default="global_speak")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]
coleccion_matriculas = database["matriculas"]


async def verificar_conexion() -> None:
    await client.admin.command("ping")
