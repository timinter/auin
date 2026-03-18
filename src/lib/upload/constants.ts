export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const EMPLOYEE_ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const EMPLOYEE_ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

export const FREELANCER_ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
] as const;

export const FREELANCER_ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv",
]);
