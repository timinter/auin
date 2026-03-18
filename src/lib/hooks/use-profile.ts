"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

// Module-level cache to avoid re-fetching across component mounts
let cachedProfile: Profile | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);
  const fetching = useRef(false);

  useEffect(() => {
    // Return cached data if still fresh
    if (cachedProfile && Date.now() - cacheTimestamp < CACHE_TTL) {
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (fetching.current) return;
    fetching.current = true;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        fetching.current = false;
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      cachedProfile = data;
      cacheTimestamp = Date.now();
      setProfile(data);
      setLoading(false);
      fetching.current = false;
    }

    load();
  }, []);

  return { profile, loading };
}

/** Call this after profile updates to invalidate the cache */
export function invalidateProfileCache() {
  cachedProfile = null;
  cacheTimestamp = 0;
}
