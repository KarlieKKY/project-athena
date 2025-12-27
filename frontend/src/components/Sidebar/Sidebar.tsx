import { Music, History, Trash2, RefreshCw } from "lucide-react";
import type { HistoryItem } from "../../api/types";

interface SidebarProps {
  history: HistoryItem[];
  currentTaskId: string | null;
  onSelectSong: (item: HistoryItem) => void;
  onDeleteSong: (taskId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const Sidebar = ({
  history,
  currentTaskId,
  onSelectSong,
  onDeleteSong,
  onRefresh,
  isLoading,
}: SidebarProps) => {
  if (history.length === 0 && !isLoading) {
    return (
      <div className="w-64 bg-gray-800 h-screen fixed left-0 top-0 p-6 border-r border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold">History</h2>
          </div>
          <button
            onClick={onRefresh}
            className="text-gray-400 hover:text-purple-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-gray-500 text-sm text-center mt-12">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No songs uploaded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-800 h-screen fixed left-0 top-0 p-6 border-r border-gray-700 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold">History</h2>
        </div>
        <button
          onClick={onRefresh}
          className={`text-gray-400 hover:text-purple-400 transition-colors ${
            isLoading ? "animate-spin" : ""
          }`}
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 mt-12">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p>Loading...</p>
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
                className={`relative group rounded-lg transition-all ${
                  isActive
                    ? "bg-purple-600 shadow-lg"
                    : "bg-gray-700 hover:bg-gray-650"
                }`}
              >
                <button
                  onClick={() => onSelectSong(item)}
                  className="w-full text-left p-3"
                >
                  <div className="flex items-start gap-2">
                    <Music className="w-4 h-4 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{songName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {stemCount} stems separated
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
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all p-1"
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
  );
};

export default Sidebar;
