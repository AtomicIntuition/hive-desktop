import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "@/pages/dashboard";
import { WorkflowsPage } from "@/pages/workflows";
import { ServersPage } from "@/pages/servers";
import { VaultPage } from "@/pages/vault";
import { SettingsPage } from "@/pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "workflows", element: <WorkflowsPage /> },
      { path: "servers", element: <ServersPage /> },
      { path: "vault", element: <VaultPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
