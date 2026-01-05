from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from services.audio_service import AudioService
from models.schemas import AudioResponse, AudioSeparationResult
from pathlib import Path
import shutil
import uuid
from datetime import datetime
from pydub import AudioSegment

router = APIRouter()
audio_service = AudioService()

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
TEMP_DIR = Path("temp")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

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

@router.post("/mix/{task_id}")
async def mix_stems(task_id: str, stem_filenames: list[str]):
    """
    Mix multiple stems into a single audio file
    
    Args:
        task_id: The task ID containing the stems
        stem_filenames: List of stem filenames to mix
    
    Returns:
        FileResponse with the mixed audio file
    """
    try:
        output_path = OUTPUT_DIR / task_id
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Validate all stems exist first
        for filename in stem_filenames:
            file_path = output_path / filename
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"Stem file not found: {filename}")
        
        # If only one stem, just return it
        if len(stem_filenames) == 1:
            file_path = output_path / stem_filenames[0]
            return FileResponse(
                path=file_path,
                filename=stem_filenames[0],
                media_type="audio/mpeg"
            )
        
        # Load and mix multiple stems
        mixed_audio = None
        
        for filename in stem_filenames:
            file_path = output_path / filename
            audio = AudioSegment.from_file(str(file_path))
            
            if mixed_audio is None:
                mixed_audio = audio
            else:
                # Overlay the audio tracks
                mixed_audio = mixed_audio.overlay(audio)
        
        # Generate output filename
        original_name = stem_filenames[0].rsplit('_', 1)[0]
        output_filename = f"{original_name}_mixed.mp3"
        temp_output_path = TEMP_DIR / f"{task_id}_{output_filename}"
        
        # Ensure temp directory exists
        TEMP_DIR.mkdir(exist_ok=True)
        
        # Export mixed audio
        mixed_audio.export(
            str(temp_output_path),
            format="mp3",
            bitrate="320k"
        )
        
        # Return file and schedule cleanup
        def cleanup():
            try:
                if temp_output_path.exists():
                    temp_output_path.unlink()
            except Exception:
                pass
        
        return FileResponse(
            path=str(temp_output_path),
            filename=output_filename,
            media_type="audio/mpeg",
            background=cleanup
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mix stems: {str(e)}")