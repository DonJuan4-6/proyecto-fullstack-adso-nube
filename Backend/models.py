from typing import Optional

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


class CursoIdioma(BaseModel):
    estudiante: str = Field(..., min_length=1, max_length=150)
    idioma_nivel: str = Field(..., min_length=1, max_length=100)
    valor_curso: float = Field(..., gt=0, allow_inf_nan=False)
    pagado: bool = False
    imagen_url: AnyHttpUrl

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("estudiante", "idioma_nivel")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value:
            raise ValueError("Este campo no puede estar vacío")
        return value


class MatriculaCreate(CursoIdioma):
    pass


class MatriculaUpdate(BaseModel):
    estudiante: Optional[str] = Field(None, min_length=1, max_length=150)
    idioma_nivel: Optional[str] = Field(None, min_length=1, max_length=100)
    valor_curso: Optional[float] = Field(None, gt=0, allow_inf_nan=False)
    pagado: Optional[bool] = None
    imagen_url: Optional[AnyHttpUrl] = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("estudiante", "idioma_nivel")
    @classmethod
    def reject_blank_text(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value:
            raise ValueError("Este campo no puede estar vacío")
        return value


class Matricula(MatriculaCreate):
    id: str
