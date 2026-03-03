import { create } from "zustand";
import type { ServerStatus } from "@hive-desktop/shared";
import type { ServerWithStatus } from "@/lib/runtime-client";

interface ServerState {
  servers: ServerWithStatus[];
  loading: boolean;
  setServers: (servers: ServerWithStatus[]) => void;
  setLoading: (loading: boolean) => void;
  updateServerStatus: (id: string, status: ServerStatus) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  loading: false,
  setServers: (servers) => set({ servers }),
  setLoading: (loading) => set({ loading }),
  updateServerStatus: (id, status) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, status } : s
      ),
    })),
}));
