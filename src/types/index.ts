export type UserRole = 'admin' | 'employee' | 'freelancer';
export type Entity = 'BY' | 'US' | 'CRYPTO';
export type PaymentChannel = 'AMC' | 'Interexy' | 'CRYPTO' | 'BANK' | 'PAYONEER';
export type ProfileStatus = 'active' | 'inactive';
export type PeriodStatus = 'open' | 'locked';
export type PayrollStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type InvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type ProjectStatus = 'active' | 'archived';
export type Department = 'Delivery' | 'HR / Sourcer' | 'Marketing' | 'Sales' | 'Leadgen' | 'Administrative';

export type FreelancerType = 'individual' | 'legal_entity';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  entity: Entity;
  department: Department | null;
  status: ProfileStatus;
  payment_channel: PaymentChannel | null;
  currency: string;
  bank_details: BankDetails | null;
  contract_start_date: string | null;
  legal_address: string | null;
  personal_email: string | null;
  service_description: string | null;
  invoice_number_prefix: string | null;
  invoice_number_seq: number;
  contract_date: string | null;
  tax_rate: number;
  // Freelancer legal entity fields
  freelancer_type: FreelancerType;
  company_name: string | null;
  registration_number: string | null;
  company_address: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  is_vat_payer: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankDetails {
  bank_name?: string;
  account_number?: string;
  swift?: string;
  iban?: string;
  routing_number?: string;
  bank_address?: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  entity: Entity;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
}

export type ContractType = 'primary' | 'amendment' | 'bonus' | 'part_time';

export interface EmployeeContract {
  id: string;
  employee_id: string;
  gross_salary: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  contract_type: ContractType;
  notes: string | null;
  terminated_at: string | null;
  terminated_by: string | null;
  created_by: string;
  created_at: string;
}

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  working_days: number;
  status: PeriodStatus;
  submission_deadline: string | null;
  payment_deadline: string | null;
}

export interface PayrollRecord {
  id: string;
  period_id: string;
  employee_id: string;
  days_worked: number;
  gross_salary: number;
  prorated_gross: number;
  bonus: number;
  bonus_note: string | null;
  compensation_amount: number;
  adjustment_amount: number;
  adjustment_reason: string | null;
  total_amount: number;
  status: PayrollStatus;
  rejection_reason: string | null;
  invoice_file_url: string | null;
  invoice_drive_file_id: string | null;
  downloaded_at: string | null;
  // Joined fields
  employee?: Profile;
  period?: PayrollPeriod;
  payment_splits?: PayrollPaymentSplit[];
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface FreelancerProjectRate {
  id: string;
  freelancer_id: string;
  project_id: string;
  hourly_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_by: string;
  // Joined
  project?: Project;
}

export interface FreelancerInvoice {
  id: string;
  period_id: string;
  freelancer_id: string;
  total_amount: number;
  status: InvoiceStatus;
  rejection_reason: string | null;
  invoice_file_url: string | null;
  invoice_drive_file_id: string | null;
  time_report_url: string | null;
  deadline_override: boolean;
  downloaded_at: string | null;
  // Joined
  freelancer?: Profile;
  period?: PayrollPeriod;
  lines?: FreelancerInvoiceLine[];
}

export type InvoiceLineType = 'project' | 'bonus';

export interface FreelancerInvoiceLine {
  id: string;
  invoice_id: string;
  project_id: string | null;
  line_type: InvoiceLineType;
  description: string | null;
  hours: number;
  hourly_rate: number;
  line_total: number;
  // Joined
  project?: Project;
}

export type CompensationStatus = 'pending' | 'approved' | 'rejected';

export interface CompensationCategory {
  id: string;
  name: string;
  label: string;
  limit_percentage: number | null;
  max_gross: number | null;
  annual_max_gross: number | null;
  is_prorated: boolean;
  admin_only: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface EmployeeCompensation {
  id: string;
  employee_id: string;
  period_id: string;
  category_id: string;
  submitted_amount: number;
  submitted_currency: string;
  approved_amount: number | null;
  receipt_date: string | null;
  receipt_url: string | null;
  status: CompensationStatus;
  submitted_at: string;
  approved_at: string | null;
  created_at: string;
  // Joined
  category?: CompensationCategory;
  period?: PayrollPeriod;
  employee?: Profile;
}

export interface ExchangeRate {
  id: string;
  period_id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
}

export interface CorporateHoliday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  profile_id: string;
  label: string;
  bank_name: string;
  account_number: string;
  swift: string;
  iban: string;
  routing_number: string;
  bank_address: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollPaymentSplit {
  id: string;
  payroll_record_id: string;
  bank_account_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
  // Joined
  bank_account?: BankAccount;
}

export type LeaveType = 'unpaid' | 'sick' | 'vacation';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  period_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Profile;
  period?: PayrollPeriod;
  reviewer?: Profile;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  // Joined
  user?: Profile;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'action';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string | null;
  read: boolean;
  created_at: string;
}
