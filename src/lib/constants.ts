/** Shared status and entity constants */

export const ENTITIES = ["BY", "US", "CRYPTO"] as const;

export const PAYROLL_STATUSES = ["draft", "pending_approval", "approved", "rejected"] as const;
export const INVOICE_STATUSES = ["draft", "pending_approval", "approved", "rejected"] as const;
export const PERIOD_STATUSES = ["open", "locked"] as const;
export const COMPENSATION_STATUSES = ["pending", "approved", "rejected"] as const;
