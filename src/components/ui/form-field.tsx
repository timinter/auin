"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactElement;
  onClearError?: () => void;
}

/**
 * Helper to create a clearError callback for a specific field.
 * Usage: onClearError={clearFieldError(setFieldErrors, "iban")}
 */
export function clearFieldError(
  setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  field: string
) {
  return () => setter((prev) => {
    if (!prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
}

export function FormField({ label, error, children, onClearError }: FormFieldProps) {
  const originalOnChange = children.props.onChange;

  const wrappedOnChange = onClearError
    ? (...args: unknown[]) => {
        if (error) onClearError();
        if (originalOnChange) originalOnChange(...args);
      }
    : originalOnChange;

  return (
    <div>
      <Label>{label}</Label>
      {React.cloneElement(children, {
        className: cn(
          children.props.className,
          error && "border-destructive focus-visible:ring-destructive"
        ),
        onChange: wrappedOnChange,
      })}
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
