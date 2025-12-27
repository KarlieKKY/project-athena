from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.audio_routes import router as audio_router
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router, prefix="/audio", tags=["audio"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Audio Processing API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)