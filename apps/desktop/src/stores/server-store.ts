import { create } from "zustand";
import type { McpServer } from "@hive-desktop/shared";

interface ServerState {
  servers: McpServer[];
  loading: boolean;
  setServers: (servers: McpServer[]) => void;
  setLoading: (loading: boolean) => void;
  updateServerStatus: (id: string, status: McpServer["status"]) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  loading: false,
  setServers: (servers) => set({ servers }),
  setLoading: (loading) => set({ loading }),
  updateServerStatus: (id, status) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, status } : s)),
    })),
}));
