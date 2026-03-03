import { create } from "zustand";

interface AppState {
  runtimeConnected: boolean;
  runtimePort: number;
  appVersion: string;
  sidebarCollapsed: boolean;
  setRuntimeConnected: (connected: boolean) => void;
  setRuntimePort: (port: number) => void;
  setAppVersion: (version: string) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  runtimeConnected: false,
  runtimePort: 45678,
  appVersion: "0.1.0",
  sidebarCollapsed: false,
  setRuntimeConnected: (connected) => set({ runtimeConnected: connected }),
  setRuntimePort: (port) => set({ runtimePort: port }),
  setAppVersion: (version) => set({ appVersion: version }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
