import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dark filled circle */}
      <circle cx="20" cy="20" r="18" fill="currentColor" />
      {/* Spinning arc (lighter, on top of dark circle) */}
      <path
        d="M20 2a18 18 0 0 1 18 18"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* White triangle logo mark */}
      <path
        d="M20 10 L28.5 26 H11.5 Z"
        fill="white"
      />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="h-8 w-8 text-foreground" />
    </div>
  );
}

export function TableSpinner({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8">
        <div className="flex items-center justify-center">
          <Spinner className="h-6 w-6 text-foreground" />
        </div>
      </td>
    </tr>
  );
}
