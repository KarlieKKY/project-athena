import {
  Music,
  History,
  Trash2,
  RefreshCw,
  Upload,
  Loader2,
} from "lucide-react";
import type { HistoryItem } from "../../api/types";
import { useDropzone } from "react-dropzone";

interface SidebarProps {
  history: HistoryItem[];
  currentTaskId: string | null;
  onSelectSong: (item: HistoryItem) => void;
  onDeleteSong: (taskId: string) => void;
  onRefresh: () => void;
  onUpload: (file: File) => void;
  isLoading: boolean;
  isUploading: boolean;
}

const Sidebar = ({
  history,
  currentTaskId,
  onSelectSong,
  onDeleteSong,
  onRefresh,
  onUpload,
  isLoading,
  isUploading,
}: SidebarProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    accept: {
      "audio/*": [".mp3", ".wav", ".ogg", ".flac"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="w-64 bg-black h-screen fixed left-0 top-0 border-r border-gray-800 overflow-y-auto">
      {/* Branding */}
      <div className="p-4">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
          Project Athena
        </h1>
      </div>

      {/* Upload Section */}
      <div className="p-4 border-b border-gray-800">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${
              isDragActive
                ? "border-pink-500 bg-pink-500/10"
                : "border-gray-700 hover:border-gray-600"
            }
            ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-pink-500 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          )}
          <p className="text-sm text-gray-300 font-medium">
            {isUploading ? "Uploading..." : "Upload Song"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isDragActive ? "Drop here" : "Click or drag"}
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          MP3, WAV, OGG, FLAC supported
        </p>
      </div>

      {/* History Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">History</h2>
          </div>
          <button
            onClick={onRefresh}
            className={`text-gray-400 hover:text-pink-400 transition-colors ${
              isLoading ? "animate-spin" : ""
            }`}
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500 mt-8">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-xs">Loading...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-gray-600 text-xs text-center mt-8">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No songs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => {
              const isActive = item.task_id === currentTaskId;
              const songName =
                item.original_filename?.replace(/\.[^/.]+$/, "") || "Unknown";
              const stemCount = item.stems?.length || 0;

              return (
                <div
                  key={item.task_id}
                  className={`relative group rounded-lg transition-all border-2 ${
                    isActive
                      ? "border-pink-500 bg-gray-900"
                      : "border-gray-700 bg-gray-900 hover:border-purple-500"
                  }`}
                >
                  <button
                    onClick={() => onSelectSong(item)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Music className="w-3 h-3 mt-1 flex-shrink-0 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs text-gray-200">
                          {songName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {stemCount} stems
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${songName}"?`)) {
                        onDeleteSong(item.task_id);
                      }
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
