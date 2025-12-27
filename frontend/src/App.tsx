import { useState, useEffect } from "react";
import AudioUpload from "./components/AudioUpload/AudioUpload";
import ResultsPanel from "./components/Results/ResultsPanel";
import Sidebar from "./components/Sidebar/Sidebar";
import type { AudioResponse, HistoryItem } from "./api/types";
import { audioApi } from "./api/audioApi";
import "./App.css";

function App() {
  const [separationResult, setSeparationResult] =
    useState<AudioResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Load history from backend
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await audioApi.getHistory();
      setHistory(response.history);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const handleUploadComplete = (result: AudioResponse) => {
    setSeparationResult(result);
    // Refresh history to include the new upload
    loadHistory();
  };

  const handleSelectSong = (item: HistoryItem) => {
    // Convert HistoryItem to AudioResponse format
    setSeparationResult({
      success: true,
      message: "Loaded from history",
      data: {
        task_id: item.task_id,
        original_filename: item.original_filename,
        stems: item.stems,
      },
    });
  };

  const handleDeleteSong = async (taskId: string) => {
    try {
      await audioApi.deleteTask(taskId);

      // Clear selection if deleted song was selected
      if (separationResult?.data?.task_id === taskId) {
        setSeparationResult(null);
      }

      // Refresh history
      loadHistory();
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete song");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <Sidebar
        history={history}
        currentTaskId={separationResult?.data?.task_id || null}
        onSelectSong={handleSelectSong}
        onDeleteSong={handleDeleteSong}
        onRefresh={loadHistory}
        isLoading={isLoadingHistory}
      />

      <div className="ml-64">
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
    </div>
  );
}

export default App;
