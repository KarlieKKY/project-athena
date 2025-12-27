import { useState } from "react";
import AudioUpload from "./components/AudioUpload/AudioUpload";
import ResultsPanel from "./components/Results/ResultsPanel";
import type { AudioResponse } from "./api/types";
import "./App.css";

function App() {
  const [separationResult, setSeparationResult] =
    useState<AudioResponse | null>(null);

  const handleUploadComplete = (result: AudioResponse) => {
    setSeparationResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Project Athena
          </h1>
          <p className="text-gray-400 text-lg">
            AI-Powered Audio Source Separation
          </p>
        </header>

        <div className="max-w-4xl mx-auto space-y-8">
          <AudioUpload onUploadComplete={handleUploadComplete} />

          {separationResult && <ResultsPanel result={separationResult} />}
        </div>

        <footer className="text-center mt-16 text-gray-500">
          <p>Powered by Demucs & FastAPI</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
