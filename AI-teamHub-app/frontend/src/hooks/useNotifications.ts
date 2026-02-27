"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/api/client";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  ticket_id: string | null;
  type: "mention" | "assignment" | "status_change";
  message: string;
  read: boolean;
  created_at: string;
}

async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetchWithAuth(`${API}/api/notifications`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

async function markOneRead(id: string): Promise<Notification> {
  const res = await fetchWithAuth(`${API}/api/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark notification as read");
  return res.json();
}

async function markAllReadApi(): Promise<void> {
  const res = await fetchWithAuth(`${API}/api/notifications/read-all`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: markOneRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return { notifications, unreadCount, isLoading, markRead, markAllRead };
}
