import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";
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
  const [timelineWavesurfer, setTimelineWavesurfer] =
    useState<WaveSurfer | null>(null);
  const timelineWaveformRef = useRef<HTMLDivElement | null>(null);

  // Time selection state
  const [timeSelection, setTimeSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState<
    "start" | "end" | null
  >(null);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);

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

    // Clear time selection
    setTimeSelection(null);
    setIsSelecting(false);
    setSelectionStart(null);
    setIsDraggingMarker(null);

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

            // Get duration from first track - do it after load completes
            if (index === 0) {
              const dur = wavesurfer.getDuration();
              console.log("Setting duration from track 0:", dur);
              setDuration(dur);
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

          // If there's a time selection and reached the end
          if (timeSelection && time >= timeSelection.end) {
            if (isRepeatEnabled) {
              // Repeat is enabled - seek back to start of selection
              const seekPosition = timeSelection.start / duration;
              tracks.forEach((track) => {
                if (track.wavesurfer) {
                  track.wavesurfer.seekTo(seekPosition);
                }
              });
              if (timelineWavesurfer) {
                timelineWavesurfer.seekTo(seekPosition);
              }
              setCurrentTime(timeSelection.start);
            } else {
              // Repeat is disabled - stop playback
              tracks.forEach((track) => {
                if (track.wavesurfer) {
                  track.wavesurfer.pause();
                }
              });
              if (timelineWavesurfer) {
                timelineWavesurfer.pause();
              }
              setIsPlaying(false);
              return;
            }
          }

          // If no selection and reached the end of the song
          if (!timeSelection && time >= duration - 0.1) {
            if (isRepeatEnabled) {
              // Repeat is enabled - seek back to start
              tracks.forEach((track) => {
                if (track.wavesurfer) {
                  track.wavesurfer.seekTo(0);
                }
              });
              if (timelineWavesurfer) {
                timelineWavesurfer.seekTo(0);
              }
              setCurrentTime(0);
            } else {
              // Repeat is disabled - stop playback
              tracks.forEach((track) => {
                if (track.wavesurfer) {
                  track.wavesurfer.pause();
                }
              });
              if (timelineWavesurfer) {
                timelineWavesurfer.pause();
              }
              setIsPlaying(false);
              return;
            }
          }
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
  }, [
    isPlaying,
    tracks,
    duration,
    timeSelection,
    timelineWavesurfer,
    isRepeatEnabled,
  ]);

  const togglePlay = () => {
    // Check if we have a time selection
    if (timeSelection) {
      const isInsideSelection =
        currentTime >= timeSelection.start && currentTime <= timeSelection.end;

      if (!isPlaying) {
        // Starting playback
        if (!isInsideSelection) {
          // Cursor is outside selection, seek to start of selection
          const seekPosition = timeSelection.start / duration;
          tracks.forEach((track) => {
            if (track.wavesurfer) {
              track.wavesurfer.seekTo(seekPosition);
            }
          });
          if (timelineWavesurfer) {
            timelineWavesurfer.seekTo(seekPosition);
          }
          setCurrentTime(timeSelection.start);
        }

        // Start playing
        tracks.forEach((track) => {
          if (track.wavesurfer) {
            track.wavesurfer.play();
          }
        });
        if (timelineWavesurfer) {
          timelineWavesurfer.setVolume(0);
          timelineWavesurfer.play();
        }
        setIsPlaying(true);
      } else {
        // Pausing playback
        tracks.forEach((track) => {
          if (track.wavesurfer) {
            track.wavesurfer.pause();
          }
        });
        if (timelineWavesurfer) {
          timelineWavesurfer.pause();
        }
        setIsPlaying(false);
      }
    } else {
      // No time selection, play/pause normally
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
    }
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

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start new selection if dragging a marker
    if (isDraggingMarker) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = x / rect.width;
    const time = clickPosition * duration;

    setIsSelecting(true);
    setSelectionStart(time);
    setTimeSelection(null);
  };

  const handleRulerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPosition = Math.max(0, Math.min(1, x / rect.width));
    const time = clickPosition * duration;

    if (isDraggingMarker && timeSelection) {
      // Dragging a marker to adjust selection
      if (isDraggingMarker === "start") {
        setTimeSelection({
          start: Math.min(time, timeSelection.end),
          end: timeSelection.end,
        });
      } else if (isDraggingMarker === "end") {
        setTimeSelection({
          start: timeSelection.start,
          end: Math.max(time, timeSelection.start),
        });
      }
    } else if (isSelecting && selectionStart !== null) {
      // Creating new selection
      const start = Math.min(selectionStart, time);
      const end = Math.max(selectionStart, time);
      setTimeSelection({ start, end });
    }
  };

  const handleRulerMouseUp = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setIsDraggingMarker(null);
  };

  const handleMarkerMouseDown = (
    marker: "start" | "end",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setIsDraggingMarker(marker);
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
          // For the clicked track, toggle mute
          return {
            ...track,
            muted: !track.muted,
          };
        }
        // Clear solo from all tracks when any mute is clicked
        return {
          ...track,
          solo: false,
        };
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

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const generateTimeMarkers = () => {
    if (duration === 0) return [];

    // Determine appropriate interval based on duration
    let interval = 10;
    if (duration > 300) interval = 30;
    if (duration > 600) interval = 60;
    const markers = [];
    for (let time = 0; time <= duration; time += interval) {
      const position = (time / duration) * 100;
      markers.push({ time, position });
    }

    return markers;
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

  const handleDownload = async () => {
    try {
      // Determine which stems to download
      const hasSolo = tracks.some((t) => t.solo);
      let stemsToDownload: string[];

      if (hasSolo) {
        stemsToDownload = tracks.filter((t) => t.solo).map((t) => t.filename);
      } else {
        stemsToDownload = tracks.filter((t) => !t.muted).map((t) => t.filename);
      }

      if (stemsToDownload.length === 0) {
        alert("No tracks selected for download");
        return;
      }

      const blob = await audioApi.mixStems(
        task_id,
        stemsToDownload,
        timeSelection || undefined
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let filename: string;
      if (timeSelection) {
        const baseFilename =
          stemsToDownload.length === 1
            ? stemsToDownload[0].replace(/\.(mp3|wav)$/, "")
            : songName;
        filename = `${baseFilename}_selection${
          stemsToDownload.length > 1 ? "_mixed" : ""
        }.mp3`;
      } else {
        filename =
          stemsToDownload.length === 1
            ? stemsToDownload[0]
            : `${songName}_mixed.mp3`;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download audio");
    }
  };

  return (
    <div className="bg-black rounded-lg p-6 shadow-xl w-full max-w-none">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">{songName}</h2>
          <p className="text-sm text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
            {timeSelection && (
              <span className="ml-2 text-pink-400">
                • Selection: {formatTime(timeSelection.start)} -{" "}
                {formatTime(timeSelection.end)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Timeline Section with Waveform */}
      <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" fill="white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
              )}
            </button>

            <button
              onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isRepeatEnabled
                  ? "bg-gradient-to-r from-pink-500 to-purple-500"
                  : "bg-gray-600"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isRepeatEnabled ? "right-0.5" : "left-0.5"
                }`}
              />
              <span
                className={`absolute text-[8px] font-semibold ${
                  isRepeatEnabled
                    ? "left-1 text-white"
                    : "right-1 text-gray-400"
                }`}
              >
                {isRepeatEnabled ? "Repeat" : "OFF"}
              </span>
            </button>
          </div>

          {/* Add spacing to match stem track layout */}
          <div className="flex-shrink-0" style={{ width: "12px" }}></div>

          <div className="flex-1">
            {/* Time Ruler */}
            <div
              className="relative mb-2 px-2 bg-gray-800 rounded-t border-b border-gray-600 cursor-crosshair select-none"
              style={{ height: "36px" }}
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
              onMouseUp={handleRulerMouseUp}
              onMouseLeave={handleRulerMouseUp}
            >
              {/* Time selection overlay on ruler */}
              {timeSelection && duration > 0 && (
                <>
                  <div
                    className="absolute top-0 bottom-0 bg-pink-500 bg-opacity-10 border-l-2 border-r-2 border-pink-400 rounded"
                    style={{
                      left: `${(timeSelection.start / duration) * 100}%`,
                      width: `${
                        ((timeSelection.end - timeSelection.start) / duration) *
                        100
                      }%`,
                    }}
                  />

                  {/* Start marker */}
                  <div
                    className="absolute flex flex-col items-center pointer-events-auto cursor-ew-resize"
                    style={{
                      left: `${(timeSelection.start / duration) * 100}%`,
                      top: "0px",
                      transform: "translateX(-50%)",
                    }}
                    onMouseDown={(e) => handleMarkerMouseDown("start", e)}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-2 bg-pink-500"></div>
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[4px] border-l-transparent border-r-transparent border-t-pink-400"></div>
                    </div>
                  </div>

                  {/* End marker */}
                  <div
                    className="absolute flex flex-col items-center pointer-events-auto cursor-ew-resize"
                    style={{
                      left: `${(timeSelection.end / duration) * 100}%`,
                      top: "0px",
                      transform: "translateX(-50%)",
                    }}
                    onMouseDown={(e) => handleMarkerMouseDown("end", e)}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-2 bg-pink-500"></div>
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[4px] border-l-transparent border-r-transparent border-t-pink-400"></div>
                    </div>
                  </div>
                </>
              )}

              {duration > 0 &&
                generateTimeMarkers().map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute flex flex-col items-center pointer-events-none"
                    style={{
                      left: `${marker.position}%`,
                      top: "0px",
                      transform: "translateX(-50%)",
                    }}
                  >
                    <span className="text-[10px] text-gray-300 font-mono whitespace-nowrap">
                      {formatTime(marker.time)}
                    </span>

                    <div className="w-px h-3 bg-gray-500"></div>
                  </div>
                ))}
            </div>

            {/* Waveform */}
            <div className="rounded-b overflow-hidden bg-gray-800 relative">
              <div
                ref={timelineWaveformRef}
                className="w-full cursor-pointer select-none"
                onClick={handleTimelineClick}
              />
            </div>
          </div>

          <div className="flex-shrink-0" style={{ width: "44px" }}>
            <button
              onClick={handleDownload}
              className="p-2 rounded bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-80 transition-opacity"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Drag on ruler to select time range • Click waveform to seek
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
                    if (timelineWavesurfer) {
                      timelineWavesurfer.seekTo(clickPosition);
                    }
                    setCurrentTime(seekTime);
                  }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex flex-col gap-1">
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
                  <button
                    onClick={() => toggleMute(index)}
                    className={`px-2 py-1 text-xs rounded font-semibold transition-colors ${
                      track.muted || track.volume === 0
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
                  <div
                    onClick={() => toggleMute(index)}
                    className="cursor-pointer"
                  >
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
