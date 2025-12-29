import { Download, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ReactElement } from "react";
import WaveSurfer from "wavesurfer.js";
import type { AudioResponse } from "../../api/types";
import { audioApi } from "../../api/audioApi";

interface ResultsPanelProps {
  result: AudioResponse;
}

interface StemTrack {
  name: string;
  filename: string;
  wavesurfer: WaveSurfer | null;
  volume: number;
  muted: boolean;
  solo: boolean;
}

const ResultsPanel = ({ result }: ResultsPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<StemTrack[]>([]);
  const waveformRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  if (!result.data) return null;

  const { task_id, original_filename, stems } = result.data;
  const songName = original_filename.replace(/\.[^/.]+$/, "");

  // Initialize track structure first
  useEffect(() => {
    // Stop all current tracks before switching
    tracks.forEach((track) => {
      if (track.wavesurfer) {
        track.wavesurfer.pause();
        track.wavesurfer.destroy();
      }
    });

    // Reset play state when switching songs
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsInitialized(false);

    const newTracks: StemTrack[] = stems.map((filename) => {
      const stemName =
        filename
          .split("_")
          .pop()
          ?.replace(/\.(mp3|wav)$/, "") || "";

      return {
        name: stemName,
        filename,
        wavesurfer: null,
        volume: 100,
        muted: false,
        solo: false,
      };
    });

    setTracks(newTracks);

    // Cleanup function
    return () => {
      newTracks.forEach((track) => {
        if (track.wavesurfer) {
          track.wavesurfer.pause();
          track.wavesurfer.destroy();
        }
      });
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [task_id, stems]);

  // Initialize waveforms after DOM is ready
  useEffect(() => {
    if (tracks.length === 0 || isInitialized) return;

    // Wait for refs to be populated
    const timer = setTimeout(() => {
      const initWaveSurfers = async () => {
        const wavesurfers = await Promise.all(
          tracks.map(async (track, index) => {
            if (!waveformRefs.current[index]) return null;

            const wavesurfer = WaveSurfer.create({
              container: waveformRefs.current[index]!,
              waveColor: "#4a5568",
              progressColor: "#ec4899",
              cursorColor: "#ffffff",
              barWidth: 2,
              barGap: 1,
              barRadius: 2,
              height: 60,
              normalize: true,
              backend: "WebAudio",
              interact: false,
            });

            await wavesurfer.load(
              audioApi.downloadStem(task_id, track.filename)
            );

            // Set duration from first track
            if (index === 0) {
              wavesurfer.on("ready", () => {
                setDuration(wavesurfer.getDuration());
              });
            }

            return wavesurfer;
          })
        );

        // Update tracks with wavesurfer instances
        setTracks((prevTracks) =>
          prevTracks.map((track, index) => ({
            ...track,
            wavesurfer: wavesurfers[index],
          }))
        );

        setIsInitialized(true);
      };

      initWaveSurfers();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [tracks, task_id, isInitialized]);

  // Update current time
  useEffect(() => {
    if (isPlaying && tracks.length > 0 && tracks[0].wavesurfer) {
      const updateTime = () => {
        const ws = tracks[0].wavesurfer;
        if (ws) {
          setCurrentTime(ws.getCurrentTime());
        }
        animationFrameRef.current = requestAnimationFrame(updateTime);
      };
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, tracks]);

  const togglePlay = () => {
    tracks.forEach((track) => {
      if (track.wavesurfer) {
        if (isPlaying) {
          track.wavesurfer.pause();
        } else {
          track.wavesurfer.play();
        }
      }
    });
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    tracks.forEach((track) => {
      if (track.wavesurfer) {
        track.wavesurfer.seekTo(newTime / duration);
      }
    });
  };

  const handleVolumeChange = (index: number, volume: number) => {
    const newTracks = [...tracks];
    newTracks[index].volume = volume;
    if (newTracks[index].wavesurfer) {
      newTracks[index].wavesurfer!.setVolume(volume / 100);
    }
    setTracks(newTracks);
  };

  const toggleMute = (index: number) => {
    const newTracks = [...tracks];
    newTracks[index].muted = !newTracks[index].muted;

    if (newTracks[index].wavesurfer) {
      // Use setVolume instead of setMuted to keep audio in sync
      newTracks[index].wavesurfer!.setVolume(
        newTracks[index].muted ? 0 : newTracks[index].volume / 100
      );
    }

    setTracks(newTracks);
  };

  const toggleSolo = (index: number) => {
    const newTracks = tracks.map((track, i) => ({
      ...track,
      solo: i === index ? !track.solo : track.solo,
    }));

    // If any track is soloed, mute all non-solo tracks
    const hasSolo = newTracks.some((t) => t.solo);
    newTracks.forEach((track, i) => {
      if (track.wavesurfer) {
        // Use setVolume instead of setMuted to keep audio in sync
        const shouldBeMuted = hasSolo ? !track.solo : track.muted;
        track.wavesurfer.setVolume(shouldBeMuted ? 0 : track.volume / 100);
      }
    });

    setTracks(newTracks);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getStemIcon = (stemName: string) => {
    const icons: { [key: string]: ReactElement } = {
      vocals: <span className="text-lg">🎤</span>,
      drums: <span className="text-lg">🥁</span>,
      bass: <span className="text-lg">🎸</span>,
      other: <span className="text-lg">🎹</span>,
    };
    return icons[stemName.toLowerCase()] || <span className="text-lg">🎵</span>;
  };

  return (
    <div className="bg-black rounded-lg p-6 shadow-xl border border-gray-800">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" fill="white" />
            ) : (
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            )}
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white">{songName}</h2>
            <p className="text-sm text-gray-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>
      </div>

      {/* Stem Tracks with Waveforms */}
      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={`${task_id}-${index}`}
            className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3">
              {/* Stem Icon */}
              <div className="flex items-center gap-2 w-20 flex-shrink-0">
                {getStemIcon(track.name)}
                <span className="text-xs font-medium capitalize text-gray-200">
                  {track.name}
                </span>
              </div>

              {/* Waveform */}
              <div className="flex-1 relative">
                <div
                  ref={(el) => {
                    waveformRefs.current[index] = el;
                  }}
                  className="w-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const clickPosition = x / rect.width;
                    const seekTime = clickPosition * duration;
                    tracks.forEach((t) => {
                      if (t.wavesurfer) {
                        t.wavesurfer.seekTo(clickPosition);
                      }
                    });
                    setCurrentTime(seekTime);
                  }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Solo Button */}
                <button
                  onClick={() => toggleSolo(index)}
                  className={`px-2 py-1 text-xs rounded font-semibold ${
                    track.solo
                      ? "bg-pink-500 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  S
                </button>

                {/* Mute Button */}
                <button
                  onClick={() => toggleMute(index)}
                  className={`px-2 py-1 text-xs rounded font-semibold ${
                    track.muted
                      ? "bg-red-500 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  M
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleMute(index)}>
                    {track.muted || track.volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume}
                    onChange={(e) =>
                      handleVolumeChange(index, parseInt(e.target.value))
                    }
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #ec4899 0%, #ec4899 ${track.volume}%, #374151 ${track.volume}%, #374151 100%)`,
                    }}
                  />
                </div>

                {/* Download Button */}
                <a
                  href={audioApi.downloadStem(task_id, track.filename)}
                  download
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsPanel;
