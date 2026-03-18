import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export async function createAuditLog(
  client: SupabaseClient,
  params: AuditLogParams
) {
  const { error } = await client.from("audit_log").insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_values: params.oldValues || null,
    new_values: params.newValues || null,
  });

  if (error) {
    console.error("Failed to create audit log:", error);
  }
}
