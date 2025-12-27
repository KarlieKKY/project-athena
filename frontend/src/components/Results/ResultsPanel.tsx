import { Download } from "lucide-react";
import type { AudioResponse } from "../../api/types";
import { audioApi } from "../../api/audioApi";
import StemPlayer from "./StemPlayer";

interface ResultsPanelProps {
  result: AudioResponse;
}

const ResultsPanel = ({ result }: ResultsPanelProps) => {
  if (!result.data) return null;

  const { task_id, original_filename, stems } = result.data;
  const songName = original_filename.replace(/\.[^/.]+$/, ""); // Remove extension

  return (
    <div className="bg-black rounded-lg p-8 shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Separated Stems</h2>
        <p className="text-gray-400 mt-1">Song: {songName}</p>
      </div>

      <div className="space-y-4">
        {stems.map((filename, index) => {
          // Extract stem type from filename: "songname_vocals.mp3" -> "vocals"
          const stemName =
            filename
              .split("_")
              .pop()
              ?.replace(/\.(mp3|wav)$/, "") || "";

          return (
            <div key={index} className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium capitalize">{stemName}</h3>
                <a
                  href={audioApi.downloadStem(task_id, filename)}
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
              <StemPlayer src={audioApi.downloadStem(task_id, filename)} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsPanel;
