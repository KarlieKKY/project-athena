from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from services.audio_service import AudioService
from models.schemas import AudioResponse, AudioSeparationResult
from pathlib import Path
import shutil
import uuid
from datetime import datetime

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
        
        # Save uploaded file with original filename
        original_filename = Path(file.filename).stem  # Get filename without extension
        file_extension = Path(file.filename).suffix
        input_filename = f"{task_id}_{original_filename}{file_extension}"
        input_path = UPLOAD_DIR / input_filename
        output_path = OUTPUT_DIR / task_id
        
        with input_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process audio
        stem_paths = audio_service.process_audio(
            in_path=str(input_path),
            out_path=str(output_path),
            original_name=original_filename,  # Pass original name
            two_stems=None,
            mp3=True,
            mp3_rate=320
        )
        
        return AudioResponse(
            success=True,
            message="Audio processed successfully",
            data={
                "task_id": task_id,
                "original_filename": file.filename,
                "stems": stem_paths
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_history():
    """Get all processed audio files from the outputs directory"""
    history = []
    
    try:
        for task_dir in OUTPUT_DIR.iterdir():
            if task_dir.is_dir():
                task_id = task_dir.name
                
                stems = list(task_dir.glob("*.mp3")) + list(task_dir.glob("*.wav"))
                
                if stems:
                    first_stem = stems[0].name
                    parts = first_stem.rsplit('_', 1)
                    original_name = parts[0] if len(parts) > 1 else first_stem.rsplit('.', 1)[0]

                    created_at = datetime.fromtimestamp(task_dir.stat().st_ctime).isoformat()
                    history.append({
                        "task_id": task_id,
                        "original_filename": f"{original_name}.mp3",  
                        "stems": [s.name for s in stems],
                        "created_at": created_at
                    })
        history.sort(key=lambda x: x["created_at"], reverse=True)
        return {"history": history}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load history: {str(e)}")

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    output_path = OUTPUT_DIR / task_id
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Task not found")
    
    stems = list(output_path.glob("*.mp3")) + list(output_path.glob("*.wav"))
    
    return {
        "task_id": task_id,
        "status": "completed" if stems else "processing",
        "stems": [s.name for s in stems]
    }

@router.get("/download/{task_id}/{filename}")
async def download_audio(task_id: str, filename: str):
    file_path = OUTPUT_DIR / task_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, filename=filename)

@router.delete("/delete/{task_id}")
async def delete_task(task_id: str):
    """Delete a task and all its associated files"""
    try:
        output_path = OUTPUT_DIR / task_id
        if output_path.exists():
            shutil.rmtree(output_path)
        
        upload_files = list(UPLOAD_DIR.glob(f"{task_id}_*"))
        for upload_file in upload_files:
            upload_file.unlink()
        
        return {"success": True, "message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")