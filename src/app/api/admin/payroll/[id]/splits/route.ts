import { requireRole } from "@/lib/auth";
import { payrollSplitSchema, uuidParam } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("payroll_payment_splits")
      .select("*, bank_account:bank_accounts(*)")
      .eq("payroll_record_id", params.id);

    if (error) return NextResponse.json({ error: "Failed to load splits" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = payrollSplitSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Get the payroll record to verify it exists and get total_amount + employee_id
    const { data: record } = await serviceClient
      .from("payroll_records")
      .select("id, employee_id, total_amount")
      .eq("id", params.id)
      .single();

    if (!record) return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });

    const { splits } = parsed.data;

    // Validate sum equals total_amount
    const sum = Math.round(splits.reduce((s, sp) => s + sp.amount, 0) * 100) / 100;
    if (Math.abs(sum - record.total_amount) > 0.01) {
      return NextResponse.json(
        { error: `Split amounts (${sum}) must equal total amount (${record.total_amount})` },
        { status: 400 }
      );
    }

    // Validate no duplicate bank accounts
    const bankIds = new Set(splits.map((s) => s.bank_account_id));
    if (bankIds.size !== splits.length) {
      return NextResponse.json({ error: "Duplicate bank accounts in splits" }, { status: 400 });
    }

    // Validate all bank accounts belong to this employee
    const { data: bankAccounts } = await serviceClient
      .from("bank_accounts")
      .select("id")
      .eq("profile_id", record.employee_id)
      .in("id", splits.map((s) => s.bank_account_id));

    const validBankIds = new Set((bankAccounts || []).map((b) => b.id));
    for (const split of splits) {
      if (!validBankIds.has(split.bank_account_id)) {
        return NextResponse.json(
          { error: "One or more bank accounts do not belong to this employee" },
          { status: 400 }
        );
      }
    }

    // Replace: delete existing splits, insert new ones
    await serviceClient
      .from("payroll_payment_splits")
      .delete()
      .eq("payroll_record_id", params.id);

    const { error: insertError } = await serviceClient
      .from("payroll_payment_splits")
      .insert(
        splits.map((s) => ({
          payroll_record_id: params.id,
          bank_account_id: s.bank_account_id,
          amount: s.amount,
        }))
      );

    if (insertError) return NextResponse.json({ error: "Failed to save splits" }, { status: 400 });

    // Return the new splits with bank account data
    const { data: result } = await serviceClient
      .from("payroll_payment_splits")
      .select("*, bank_account:bank_accounts(*)")
      .eq("payroll_record_id", params.id);

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
