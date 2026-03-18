import { createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DEV-ONLY: Seed test users via GoTrue admin API + service role.
 * Creates users through the proper auth API (not raw SQL),
 * then updates profiles and creates contracts via service role.
 */

interface TestUser {
  email: string;
  first_name: string;
  last_name: string;
  role: "employee" | "freelancer";
  entity: "BY" | "US" | "CRYPTO";
  department: string | null;
  payment_channel: string;
  salary: number;
}

const TEST_USERS: TestUser[] = [
  // BY Employees (3)
  { email: "aleksei.kuznetsov@interexy.com", first_name: "Aleksei", last_name: "Kuznetsov", role: "employee", entity: "BY", department: "Development", payment_channel: "AMC", salary: 2200 },
  { email: "marina.ivanova@interexy.com", first_name: "Marina", last_name: "Ivanova", role: "employee", entity: "BY", department: "Delivery", payment_channel: "AMC", salary: 1800 },
  { email: "viktor.morozov@interexy.com", first_name: "Viktor", last_name: "Morozov", role: "employee", entity: "BY", department: "HR", payment_channel: "AMC", salary: 1500 },
  // US Employees (3)
  { email: "william.dafoe@interexy.com", first_name: "William", last_name: "Dafoe", role: "employee", entity: "US", department: "Development", payment_channel: "Interexy", salary: 7500 },
  { email: "scarlett.johansson@interexy.com", first_name: "Scarlett", last_name: "Johansson", role: "employee", entity: "US", department: "Delivery", payment_channel: "Interexy", salary: 8000 },
  { email: "leonardo.dicaprio@interexy.com", first_name: "Leonardo", last_name: "DiCaprio", role: "employee", entity: "US", department: "Sales", payment_channel: "Interexy", salary: 9500 },
  // CRYPTO Employees (3)
  { email: "satoshi.nakamoto@interexy.com", first_name: "Satoshi", last_name: "Nakamoto", role: "employee", entity: "CRYPTO", department: "Development", payment_channel: "CRYPTO", salary: 4500 },
  { email: "vitalik.buterin@interexy.com", first_name: "Vitalik", last_name: "Buterin", role: "employee", entity: "CRYPTO", department: "Development", payment_channel: "CRYPTO", salary: 5200 },
  { email: "charles.hoskinson@interexy.com", first_name: "Charles", last_name: "Hoskinson", role: "employee", entity: "CRYPTO", department: "Delivery", payment_channel: "CRYPTO", salary: 4000 },
  // BY Freelancers (3)
  { email: "gleb.kravchenko@interexy.com", first_name: "Gleb", last_name: "Kravchenko", role: "freelancer", entity: "BY", department: null, payment_channel: "BANK", salary: 0 },
  { email: "zhanna.solovyova@interexy.com", first_name: "Zhanna", last_name: "Solovyova", role: "freelancer", entity: "BY", department: null, payment_channel: "BANK", salary: 0 },
  { email: "stanislav.kolesnikov@interexy.com", first_name: "Stanislav", last_name: "Kolesnikov", role: "freelancer", entity: "BY", department: null, payment_channel: "PAYONEER", salary: 0 },
  // US Freelancers (3)
  { email: "harrison.ford@interexy.com", first_name: "Harrison", last_name: "Ford", role: "freelancer", entity: "US", department: null, payment_channel: "BANK", salary: 0 },
  { email: "angelina.jolie@interexy.com", first_name: "Angelina", last_name: "Jolie", role: "freelancer", entity: "US", department: null, payment_channel: "PAYONEER", salary: 0 },
  { email: "brad.pitt@interexy.com", first_name: "Brad", last_name: "Pitt", role: "freelancer", entity: "US", department: null, payment_channel: "BANK", salary: 0 },
  // CRYPTO Freelancers (3)
  { email: "ada.lovelace@interexy.com", first_name: "Ada", last_name: "Lovelace", role: "freelancer", entity: "CRYPTO", department: null, payment_channel: "CRYPTO", salary: 0 },
  { email: "hal.finney@interexy.com", first_name: "Hal", last_name: "Finney", role: "freelancer", entity: "CRYPTO", department: null, payment_channel: "CRYPTO", salary: 0 },
  { email: "wei.dai@interexy.com", first_name: "Wei", last_name: "Dai", role: "freelancer", entity: "CRYPTO", department: null, payment_channel: "CRYPTO", salary: 0 },
];

function getCurrency(entity: string) {
  if (entity === "BY") return "BYN";
  if (entity === "CRYPTO") return "USDT";
  return "USD";
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const u of TEST_USERS) {
      // Check if user already exists in profiles
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", u.email)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Create user via GoTrue admin API (handles auth.users + auth.identities)
      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: "password123",
        email_confirm: true,
        user_metadata: {
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role,
        },
      });

      if (createError) {
        errors.push(`${u.email}: ${createError.message}`);
        continue;
      }

      const userId = authData.user.id;

      // Update the auto-created profile with full data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          entity: u.entity,
          department: u.department,
          payment_channel: u.payment_channel,
          currency: getCurrency(u.entity),
          contract_start_date: new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0],
          legal_address: u.entity === "BY" ? "Minsk, Belarus" : u.entity === "US" ? "New York, NY, USA" : "Remote",
          personal_email: u.email.replace("@interexy.com", "@gmail.com"),
          service_description: u.role === "freelancer" ? "Software development and consulting services" : null,
        })
        .eq("id", userId);

      if (profileError) {
        errors.push(`${u.email} profile: ${profileError.message}`);
        continue;
      }

      // Create employee contract if salary > 0
      if (u.salary > 0) {
        const { error: contractError } = await supabase
          .from("employee_contracts")
          .insert({
            employee_id: userId,
            gross_salary: u.salary,
            currency: getCurrency(u.entity),
            effective_from: new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0],
          });

        if (contractError) {
          errors.push(`${u.email} contract: ${contractError.message}`);
          continue;
        }
      }

      created++;
    }

    // Create projects
    await supabase.from("projects").upsert([
      { name: "SAMAP Platform", status: "active" },
      { name: "Mobile Banking App", status: "active" },
      { name: "E-Commerce Redesign", status: "active" },
    ], { onConflict: "name" }).throwOnError().catch(() => {});

    // Create payroll periods
    for (const p of [
      { year: 2026, month: 1, working_days: 20, status: "locked", submission_deadline: "2026-02-10", payment_deadline: "2026-02-20" },
      { year: 2026, month: 2, working_days: 20, status: "locked", submission_deadline: "2026-03-10", payment_deadline: "2026-03-20" },
      { year: 2026, month: 3, working_days: 22, status: "open", submission_deadline: "2026-04-10", payment_deadline: "2026-04-20" },
    ]) {
      await supabase.from("payroll_periods").upsert(p, { onConflict: "year,month" }).catch(() => {});
    }

    return NextResponse.json({ created, skipped, errors, total: TEST_USERS.length });
  } catch (err) {
    console.error("Dev seed error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
