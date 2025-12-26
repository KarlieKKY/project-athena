from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from services.audio_service import AudioService
from models.schemas import AudioResponse, AudioSeparationResult
from pathlib import Path
import shutil
import uuid

router = APIRouter()
audio_service = AudioService()

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

@router.post("/upload", response_model=AudioResponse)
async def upload_audio(file: UploadFile = File(...)):
    try:
        task_id = str(uuid.uuid4())
        
        # Save uploaded file
        file_extension = Path(file.filename).suffix
        input_path = UPLOAD_DIR / f"{task_id}{file_extension}"
        output_path = OUTPUT_DIR / task_id
        
        with input_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process audio
        stem_paths = audio_service.process_audio(
            in_path=str(input_path),
            out_path=str(output_path),
            two_stems=None,
            mp3=True,
            mp3_rate=320
        )
        
        return AudioResponse(
            success=True,
            message="Audio processed successfully",
            data={
                "task_id": task_id,
                "stems": stem_paths
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    output_path = OUTPUT_DIR / task_id
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Task not found")
    
    stems = list(output_path.glob("*.mp3")) + list(output_path.glob("*.wav"))
    
    return {
        "task_id": task_id,
        "status": "completed" if stems else "processing",
        "stems": [str(s) for s in stems]
    }

@router.get("/download/{task_id}/{filename}")
async def download_audio(task_id: str, filename: str):
    file_path = OUTPUT_DIR / task_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename)