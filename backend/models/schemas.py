from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

class StemType(str, Enum):
    """Enum for available stem types"""
    VOCALS = "vocals"
    DRUMS = "drums"
    BASS = "bass"
    OTHER = "other"

class AudioFileUpload(BaseModel):
    """Schema for audio file upload request"""
    file: str  # Path to the uploaded audio file
    two_stems: Optional[str] = None  # Optional parameter to specify which stems to separate

class AudioSeparationRequest(BaseModel):
    """Schema for audio separation request"""
    file_path: str
    two_stems: Optional[str] = None
    mp3: bool = True
    mp3_rate: int = 320
    float32: bool = False
    int24: bool = False

class AudioSeparationResult(BaseModel):
    """Schema for audio separation result"""
    stems: List[str]  # List of paths to the separated audio stems
    message: str  # Message indicating the result of the processing

class AudioResponse(BaseModel):
    """Schema for general audio API responses"""
    success: bool
    message: str
    data: Optional[dict] = None

class SeparationStatus(BaseModel):
    """Schema for separation task status"""
    task_id: str
    status: str  # pending, processing, completed, failed
    progress: Optional[int] = None
    result: Optional[AudioSeparationResult] = None
    error: Optional[str] = None

class DeviceInfo(BaseModel):
    """Schema for device information"""
    cuda_available: bool
    device_name: Optional[str] = None
    pytorch_version: str
    cuda_version: Optional[str] = None