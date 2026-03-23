import { requireAuth } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { bankAccountSchema, uuidParam } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Sync the primary bank account back to profiles.bank_details for backward compat (PDF generation) */
async function syncPrimaryToProfile(serviceClient: ServiceClient, userId: string) {
  const { data: primary } = await serviceClient
    .from("bank_accounts")
    .select("bank_name, account_number, swift, iban, routing_number, bank_address")
    .eq("profile_id", userId)
    .eq("is_primary", true)
    .single();

  const bankDetails = primary
    ? {
        bank_name: primary.bank_name || "",
        account_number: primary.account_number || "",
        swift: primary.swift || "",
        iban: primary.iban || "",
        routing_number: primary.routing_number || "",
        bank_address: primary.bank_address || "",
      }
    : {};

  await serviceClient
    .from("profiles")
    .update({ bank_details: bankDetails })
    .eq("id", userId);
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { data, error } = await serviceClient
      .from("bank_accounts")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order");

    if (error) return NextResponse.json({ error: "Failed to load bank accounts" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = bankAccountSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Check count limit
    const { count } = await serviceClient
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id);

    if ((count || 0) >= 5) {
      return NextResponse.json({ error: "Maximum 5 bank accounts allowed" }, { status: 400 });
    }

    // If first account, auto-set as primary
    const isPrimary = (count || 0) === 0 ? true : parsed.data.is_primary;

    // If setting as primary, unset existing primary
    if (isPrimary) {
      await serviceClient
        .from("bank_accounts")
        .update({ is_primary: false })
        .eq("profile_id", user.id)
        .eq("is_primary", true);
    }

    const { data, error } = await serviceClient
      .from("bank_accounts")
      .insert({
        ...parsed.data,
        profile_id: user.id,
        is_primary: isPrimary,
        sort_order: (count || 0),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create bank account" }, { status: 400 });

    await syncPrimaryToProfile(serviceClient, user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const { id, ...rest } = body;

    if (!id || !uuidParam.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid bank account ID" }, { status: 400 });
    }

    const parsed = bankAccountSchema.safeParse(rest);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("bank_accounts")
      .select("id")
      .eq("id", id)
      .eq("profile_id", user.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    // If setting as primary, unset existing primary
    if (parsed.data.is_primary) {
      await serviceClient
        .from("bank_accounts")
        .update({ is_primary: false })
        .eq("profile_id", user.id)
        .eq("is_primary", true);
    }

    const { data, error } = await serviceClient
      .from("bank_accounts")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to update bank account" }, { status: 400 });

    await syncPrimaryToProfile(serviceClient, user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { id } = await request.json();
    if (!id || !uuidParam.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid bank account ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("bank_accounts")
      .select("id, is_primary")
      .eq("id", id)
      .eq("profile_id", user.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    // Check if used in payroll splits
    const { count } = await serviceClient
      .from("payroll_payment_splits")
      .select("id", { count: "exact", head: true })
      .eq("bank_account_id", id);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Cannot delete: this bank account is used in payroll payment splits" },
        { status: 409 }
      );
    }

    const { error } = await serviceClient
      .from("bank_accounts")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: "Failed to delete bank account" }, { status: 400 });

    // If we deleted the primary, promote the first remaining account
    if (existing.is_primary) {
      const { data: remaining } = await serviceClient
        .from("bank_accounts")
        .select("id")
        .eq("profile_id", user.id)
        .order("sort_order")
        .limit(1);

      if (remaining && remaining.length > 0) {
        await serviceClient
          .from("bank_accounts")
          .update({ is_primary: true })
          .eq("id", remaining[0].id);
      }
    }

    await syncPrimaryToProfile(serviceClient, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
