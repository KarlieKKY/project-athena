import { Play, Pause, Volume2, VolumeX } from "lucide-react";
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
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const waveformRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [timelineWavesurfer, setTimelineWavesurfer] =
    useState<WaveSurfer | null>(null);
  const timelineWaveformRef = useRef<HTMLDivElement | null>(null);

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

    // Destroy timeline wavesurfer
    if (timelineWavesurfer) {
      timelineWavesurfer.pause();
      timelineWavesurfer.destroy();
      setTimelineWavesurfer(null);
    }

    // Reset play state when switching songs
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsInitialized(false);
    setSelectionStart(null);
    setSelectionEnd(null);

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
        // Initialize timeline waveform first
        let timelineWs: WaveSurfer | null = null;
        if (timelineWaveformRef.current && tracks.length > 0) {
          timelineWs = WaveSurfer.create({
            container: timelineWaveformRef.current,
            waveColor: "#4a5568",
            progressColor: "#ec4899",
            cursorColor: "#ffffff",
            cursorWidth: 2,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 80,
            normalize: true,
            backend: "WebAudio",
            interact: true,
          });

          await timelineWs.load(
            audioApi.downloadStem(task_id, tracks[0].filename)
          );

          // Mute timeline so it doesn't play audio, only displays waveform
          timelineWs.setVolume(0);

          setTimelineWavesurfer(timelineWs);
        }

        const wavesurfers = await Promise.all(
          tracks.map(async (track, index) => {
            if (!waveformRefs.current[index]) return null;

            const wavesurfer = WaveSurfer.create({
              container: waveformRefs.current[index]!,
              waveColor: "#4a5568",
              progressColor: "#ec4899",
              cursorColor: "#ffffff",
              cursorWidth: 2,
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

            // Get duration from first track
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
  }, [tracks, task_id, isInitialized, stems]);

  // Update current time
  useEffect(() => {
    if (isPlaying && tracks.length > 0 && tracks[0].wavesurfer) {
      const updateTime = () => {
        const ws = tracks[0].wavesurfer;
        if (ws) {
          const time = ws.getCurrentTime();
          setCurrentTime(time);
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
  }, [isPlaying, tracks, duration]);

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

    if (timelineWavesurfer) {
      timelineWavesurfer.setVolume(0);
      if (isPlaying) {
        timelineWavesurfer.pause();
      } else {
        timelineWavesurfer.play();
      }
    }

    setIsPlaying(!isPlaying);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineWaveformRef.current || !timelineWavesurfer) return;
    const rect = timelineWaveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = x / rect.width;
    const seekTime = clickPosition * duration;

    tracks.forEach((track) => {
      if (track.wavesurfer) {
        track.wavesurfer.seekTo(clickPosition);
      }
    });
    timelineWavesurfer.seekTo(clickPosition);
    setCurrentTime(seekTime);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineWaveformRef.current) return;
    const rect = timelineWaveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = x / rect.width;
    const time = clickPosition * duration;

    setIsDragging(true);
    setDragStart(time);
    setSelectionStart(time);
    setSelectionEnd(time);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineWaveformRef.current || dragStart === null)
      return;

    const rect = timelineWaveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = x / rect.width;
    const time = clickPosition * duration;

    if (time < dragStart) {
      setSelectionStart(time);
      setSelectionEnd(dragStart);
    } else {
      setSelectionStart(dragStart);
      setSelectionEnd(time);
    }
  };

  const handleTimelineMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleVolumeChange = (index: number, volume: number) => {
    const newTracks = [...tracks];
    newTracks[index].volume = volume;

    const hasSolo = newTracks.some((t) => t.solo);

    if (newTracks[index].wavesurfer) {
      let targetVolume = 0;

      if (hasSolo) {
        // If solo is active, only play solo tracks
        targetVolume = newTracks[index].solo ? volume / 100 : 0;
      } else {
        // No solo active, respect mute state
        targetVolume = newTracks[index].muted ? 0 : volume / 100;
      }

      newTracks[index].wavesurfer.setVolume(targetVolume);
    }
    setTracks(newTracks);
  };

  const toggleMute = (index: number) => {
    setTracks((prevTracks) => {
      const newTracks = prevTracks.map((track, i) => {
        if (i === index) {
          // For the clicked track, toggle mute and clear solo if we're muting
          return {
            ...track,
            muted: !track.muted,
            solo: track.muted ? track.solo : false, // Only clear solo if currently unmuted (about to be muted)
          };
        }
        return track;
      });

      const hasSolo = newTracks.some((t) => t.solo);

      // Apply volume changes immediately
      newTracks.forEach((track) => {
        if (track.wavesurfer) {
          let targetVolume = 0;

          if (hasSolo) {
            targetVolume = track.solo ? track.volume / 100 : 0;
          } else {
            targetVolume = track.muted ? 0 : track.volume / 100;
          }
          track.wavesurfer.setVolume(targetVolume);
        }
      });

      return newTracks;
    });
  };

  const toggleSolo = (index: number) => {
    setTracks((prevTracks) => {
      // ✅ Use functional update
      const newTracks = prevTracks.map((track, i) => ({
        ...track,
        solo: i === index ? !track.solo : false,
        muted: false,
      }));

      const hasSolo = newTracks.some((t) => t.solo);

      newTracks.forEach((track) => {
        if (track.wavesurfer) {
          const targetVolume = hasSolo
            ? track.solo
              ? track.volume / 100
              : 0
            : track.volume / 100;
          track.wavesurfer.setVolume(targetVolume);
        }
      });

      return newTracks;
    });
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
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
      <div className="mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">{songName}</h2>
          <p className="text-sm text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>
      </div>

      {/* Timeline Section with Waveform */}
      <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-300">Timeline</h3>
          {selectionStart !== null && selectionEnd !== null && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono">
                {formatTime(selectionStart)} → {formatTime(selectionEnd)}
                <span className="ml-2 text-pink-400">
                  ({formatTime(selectionEnd - selectionStart)})
                </span>
              </span>
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Play Button + Waveform */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" fill="white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            )}
          </button>

          <div className="flex-1 rounded overflow-hidden bg-gray-800">
            <div
              ref={timelineWaveformRef}
              className="w-full cursor-pointer"
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={handleTimelineMouseUp}
              onClick={handleTimelineClick}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Click to seek • Drag to select time range
        </p>
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
                {/* Solo and Mute Buttons - Vertical Layout */}
                <div className="flex flex-col gap-1">
                  {/* Solo Button */}
                  <button
                    onClick={() => toggleSolo(index)}
                    className={`px-2 py-1 text-xs rounded font-semibold transition-colors ${
                      track.solo
                        ? "bg-pink-500 text-white"
                        : tracks.some((t) => t.solo)
                        ? "bg-gray-800 text-gray-600 hover:bg-gray-700"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    }`}
                  >
                    S
                  </button>

                  {/* Mute Button */}
                  <button
                    onClick={() => toggleMute(index)}
                    className={`px-2 py-1 text-xs rounded font-semibold transition-colors ${
                      track.muted
                        ? "bg-red-500 text-white"
                        : tracks.some((t) => t.solo)
                        ? "bg-gray-800 text-gray-600 hover:bg-gray-700"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    }`}
                  >
                    M
                  </button>
                </div>

                {/* Volume Control - Vertical Layout */}
                <div className="flex flex-col items-center gap-1 h-20">
                  <div>
                    {track.muted || track.volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume}
                    onChange={(e) =>
                      handleVolumeChange(index, parseInt(e.target.value))
                    }
                    className="h-16 w-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      WebkitAppearance: "slider-vertical",
                      background: `linear-gradient(to top, #ec4899 0%, #ec4899 ${track.volume}%, #374151 ${track.volume}%, #374151 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsPanel;
