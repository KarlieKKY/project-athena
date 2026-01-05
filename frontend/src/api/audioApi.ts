import axios from "axios";
import type { AudioResponse, SeparationStatus, HistoryResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const audioApi = {
  uploadAudio: async (file: File): Promise<AudioResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post<AudioResponse>(
      "/audio/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  getHistory: async (): Promise<HistoryResponse> => {
    const response = await apiClient.get<HistoryResponse>("/audio/history");
    return response.data;
  },

  getStatus: async (taskId: string): Promise<SeparationStatus> => {
    const response = await apiClient.get<SeparationStatus>(
      `/audio/status/${taskId}`
    );
    return response.data;
  },

  downloadStem: (taskId: string, filename: string): string => {
    return `${API_BASE_URL}/audio/download/${taskId}/${filename}`;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await apiClient.delete(`/audio/delete/${taskId}`);
  },

  mixStems: async (taskId: string, stemFilenames: string[]): Promise<Blob> => {
    const response = await apiClient.post(
      `/audio/mix/${taskId}`,
      stemFilenames,
      {
        responseType: "blob",
      }
    );
    return response.data;
  },
};
