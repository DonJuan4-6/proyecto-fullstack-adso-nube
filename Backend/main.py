from contextlib import asynccontextmanager
import os
from typing import AsyncIterator, List, Optional

from bson import ObjectId
from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

from database import client, coleccion_matriculas, verificar_conexion
from models import CursoIdioma, Matricula, MatriculaCreate, MatriculaUpdate


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await verificar_conexion()
    try:
        yield
    finally:
        client.close()


app = FastAPI(
    title="Global Speak API",
    description="API para administrar matrículas del Centro de Idiomas Global Speak.",
    version="1.0.0",
    lifespan=lifespan,
)


def matricula_para_respuesta(documento: dict) -> dict:
    documento["id"] = str(documento.pop("_id"))
    return documento


def object_id_o_error(id: str) -> ObjectId:
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El formato del ID '{id}' no es un ObjectId válido de MongoDB",
        )
    return ObjectId(id)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/", tags=["Información"])
async def root() -> dict:
    return {
        "mensaje": "API de matrículas de Global Speak",
        "documentacion": "/docs",
    }


@app.get("/health", tags=["Información"])
async def health() -> dict:
    await verificar_conexion()
    return {"estado": "ok"}


@app.get(
    "/matriculas",
    response_model=List[Matricula],
    tags=["Matrículas"],
    summary="Listar matrículas",
)
async def listar_matriculas(
    pagado: Optional[bool] = Query(default=None),
) -> List[dict]:
    filtro = {} if pagado is None else {"pagado": pagado}
    cursor = coleccion_matriculas.find(filtro).sort("_id", -1)
    return [matricula_para_respuesta(documento) async for documento in cursor]


@app.post(
    "/matriculas",
    response_model=Matricula,
    status_code=status.HTTP_201_CREATED,
    tags=["Matrículas"],
    summary="Crear matrícula",
)
async def crear_matricula(matricula: MatriculaCreate) -> dict:
    documento = matricula.model_dump(mode="json")
    resultado = await coleccion_matriculas.insert_one(documento)
    documento["id"] = str(resultado.inserted_id)
    return documento


@app.get(
    "/matriculas/{id}",
    response_model=Matricula,
    tags=["Matrículas"],
    summary="Obtener matrícula",
)
async def obtener_matricula(id: str) -> dict:
    documento = await coleccion_matriculas.find_one({"_id": object_id_o_error(id)})
    if documento is None:
        raise HTTPException(status_code=404, detail="Matrícula no encontrada")
    return matricula_para_respuesta(documento)


@app.put(
    "/matriculas/{id}",
    response_model=Matricula,
    tags=["Matrículas"],
    summary="Actualizar matrícula",
)
async def actualizar_matricula(id: str, actualizacion: MatriculaUpdate) -> dict:
    object_id = object_id_o_error(id)
    cambios = actualizacion.model_dump(exclude_unset=True, mode="json")
    if any(value is None for value in cambios.values()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Los campos enviados no pueden ser null",
        )

    if cambios:
        resultado = await coleccion_matriculas.update_one(
            {"_id": object_id},
            {"$set": cambios},
        )
        if resultado.matched_count == 0:
            raise HTTPException(status_code=404, detail="Matrícula no encontrada")

    documento = await coleccion_matriculas.find_one({"_id": object_id})
    if documento is None:
        raise HTTPException(status_code=404, detail="Matrícula no encontrada")
    return matricula_para_respuesta(documento)


@app.delete(
    "/matriculas/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    tags=["Matrículas"],
    summary="Eliminar matrícula",
)
async def eliminar_matricula(id: str) -> Response:
    resultado = await coleccion_matriculas.delete_one(
        {"_id": object_id_o_error(id)}
    )
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Matrícula no encontrada")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(
    "/estudiantes",
    response_model=List[CursoIdioma],
    tags=["Estudiantes"],
    summary="Listar estudiantes con matrícula",
)
async def listar_estudiantes() -> List[dict]:
    cursor = coleccion_matriculas.aggregate(
        [
            {"$sort": {"_id": -1}},
            {
                "$group": {
                    "_id": "$estudiante",
                    "matricula": {"$first": "$$ROOT"},
                }
            },
            {"$replaceRoot": {"newRoot": "$matricula"}},
            {"$sort": {"_id": -1}},
        ]
    )
    return [matricula_para_respuesta(documento) async for documento in cursor]
