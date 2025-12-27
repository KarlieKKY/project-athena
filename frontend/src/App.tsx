import { useState, useEffect } from "react";
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
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await audioApi.uploadAudio(file);
      setSeparationResult(result);
      // Refresh history to include the new upload
      loadHistory();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
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
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <Sidebar
        history={history}
        currentTaskId={separationResult?.data?.task_id || null}
        onSelectSong={handleSelectSong}
        onDeleteSong={handleDeleteSong}
        onRefresh={loadHistory}
        onUpload={handleUpload}
        isLoading={isLoadingHistory}
        isUploading={isUploading}
      />

      <div className="ml-64">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
              Stems
            </h1>
          </header>

          <div className="max-w-4xl mx-auto space-y-8">
            {separationResult && <ResultsPanel result={separationResult} />}
          </div>
        </div>
      </div>
      <footer className="text-center mt-16 text-gray-500">
        <p>Powered by Demucs & FastAPI</p>
      </footer>
    </div>
  );
}

export default App;
