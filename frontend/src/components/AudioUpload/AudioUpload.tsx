import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Music } from "lucide-react";
import { audioApi } from "../../api/audioApi";
import type { AudioResponse } from "../../api/types";
import Spinner from "../common/Spinner";

interface AudioUploadProps {
  onUploadComplete: (result: AudioResponse) => void;
}

const AudioUpload = ({ onUploadComplete }: AudioUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await audioApi.uploadAudio(file);
      onUploadComplete(result);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".ogg", ".flac"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <Music className="w-6 h-6" />
        Upload Audio
      </h2>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-purple-500 bg-purple-500/10"
              : "border-gray-600 hover:border-gray-500"
          }
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-gray-400">Processing audio...</p>
            {progress > 0 && (
              <div className="w-full max-w-xs bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-lg mb-2">
              {isDragActive
                ? "Drop the audio file here"
                : "Drag & drop an audio file"}
            </p>
            <p className="text-sm text-gray-500">
              or click to browse (MP3, WAV, OGG, FLAC)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioUpload;
