"use client";
import { useQuery } from "@tanstack/react-query";

const API = process.env.NEXT_PUBLIC_API_URL;

interface AppConfig {
  ai_team_hourly_rate: number;
  ai_enabled: boolean;
}

async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API}/api/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export function useAiEnabled(): boolean {
  const { data } = useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: 300_000,
  });
  return data?.ai_enabled ?? false;
}
