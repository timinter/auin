"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Entity } from "@/types";

export const ENTITIES: Entity[] = ["BY", "US", "CRYPTO"];

export const ENTITY_LABELS: Record<Entity, string> = {
  BY: "BY AMS",
  US: "United States",
  CRYPTO: "Crypto",
};

interface EntityContextValue {
  entity: Entity;
  setEntity: (e: Entity) => void;
}

const EntityContext = createContext<EntityContextValue>({
  entity: "US",
  setEntity: () => {},
});

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntityState] = useState<Entity>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("samap_entity") as Entity) || "US";
    }
    return "US";
  });

  const setEntity = useCallback((e: Entity) => {
    setEntityState(e);
    localStorage.setItem("samap_entity", e);
  }, []);

  return (
    <EntityContext.Provider value={{ entity, setEntity }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  return useContext(EntityContext);
}
