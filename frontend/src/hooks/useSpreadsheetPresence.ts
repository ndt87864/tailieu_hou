// frontend/src/hooks/useSpreadsheetPresence.ts
import { useState, useEffect } from "react";
import { supabase } from "../context/AuthContext.js";
import { User } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  email: string | null;
  role?: string;
  color: string;
  onlineAt: string;
}

// Bảng màu avatar Google Docs/Sheets quen thuộc
const USER_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#84cc16", // lime
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

export const useSpreadsheetPresence = (
  sheetId: string | undefined,
  currentUser: User | null,
  currentProfile: any | null,
  role: string = "free"
) => {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!sheetId || !currentUser) {
      setActiveUsers([]);
      return;
    }

    const userName =
      currentProfile?.full_name ||
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email?.split("@")[0] ||
      "Người dùng";

    const userAvatar =
      currentProfile?.avatar_url ||
      currentUser.user_metadata?.avatar_url ||
      currentUser.user_metadata?.picture ||
      null;

    const userColor = getUserColor(currentUser.id);

    const channelName = `presence:sheet:${sheetId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    const updatePresenceUsers = () => {
      const state = channel.presenceState();
      const uniqueUsersMap = new Map<string, PresenceUser>();

      Object.keys(state).forEach((key) => {
        const presences = state[key] as any[];
        if (presences && presences.length > 0) {
          const latestPresence = presences[presences.length - 1];
          uniqueUsersMap.set(key, {
            userId: key,
            name: latestPresence.name || "Người dùng",
            avatar: latestPresence.avatar || null,
            email: latestPresence.email || null,
            role: latestPresence.role || "free",
            color: latestPresence.color || getUserColor(key),
            onlineAt: latestPresence.onlineAt || new Date().toISOString(),
          });
        }
      });

      setActiveUsers(Array.from(uniqueUsersMap.values()));
    };

    channel
      .on("presence", { event: "sync" }, updatePresenceUsers)
      .on("presence", { event: "join" }, updatePresenceUsers)
      .on("presence", { event: "leave" }, updatePresenceUsers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.id,
            name: userName,
            avatar: userAvatar,
            email: currentUser.email || null,
            role,
            color: userColor,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [sheetId, currentUser?.id, currentProfile?.full_name, currentProfile?.avatar_url, role]);

  return { activeUsers };
};
