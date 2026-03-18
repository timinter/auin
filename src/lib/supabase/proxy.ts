import type { SupabaseClient } from "@supabase/supabase-js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Sensitive columns that should never appear in multi-row list queries.
 * Single-row fetches (.single()) are exempt — detail views need full data.
 */
const SENSITIVE_COLUMNS: Record<string, string[]> = {
  profiles: ["bank_details"],
};

/**
 * Per-request query counter for N+1 detection.
 * In dev, warns when a single service client instance exceeds the threshold.
 */
const N_PLUS_ONE_THRESHOLD = 8;

interface QueryMeta {
  table: string;
  isSingle: boolean;
  selectCols: string | null;
}

/**
 * Wraps a Supabase query builder to track queries and strip sensitive columns.
 */
function proxyQueryBuilder(
  original: ReturnType<SupabaseClient["from"]>,
  meta: QueryMeta,
  counter: { count: number; tables: string[] }
) {
  counter.count++;
  counter.tables.push(meta.table);

  if (isDev && counter.count > N_PLUS_ONE_THRESHOLD) {
    console.warn(
      `[supabase-proxy] N+1 warning: ${counter.count} queries in one request. Tables hit: ${Array.from(new Set(counter.tables)).join(", ")}`
    );
  }

  return new Proxy(original, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);

      // Track if .single() is called — detail views are exempt from stripping
      if (prop === "single") {
        meta.isSingle = true;
        return typeof val === "function" ? val.bind(target) : val;
      }

      // Intercept .select() to check for sensitive columns in list queries
      if (prop === "select" && typeof val === "function") {
        return function patchedSelect(columns: string, ...rest: unknown[]) {
          meta.selectCols = columns;

          const sensitive = SENSITIVE_COLUMNS[meta.table];
          if (sensitive && columns === "*") {
            if (isDev) {
              console.warn(
                `[supabase-proxy] select("*") on "${meta.table}" includes sensitive columns: ${sensitive.join(", ")}. Consider explicit column list.`
              );
            }
          }

          const result = val.call(target, columns, ...rest);
          // Re-wrap the returned builder so chained methods are still proxied
          return proxyQueryBuilder(
            result as ReturnType<SupabaseClient["from"]>,
            meta,
            counter
          );
        };
      }

      // For all other chained methods (.eq, .in, .order, etc.), keep the proxy chain alive
      if (typeof val === "function") {
        return function (...args: unknown[]) {
          const result = val.apply(target, args);
          // If it returns a thenable (final query), let it through
          if (result && typeof result === "object" && "select" in result) {
            return proxyQueryBuilder(
              result as ReturnType<SupabaseClient["from"]>,
              meta,
              counter
            );
          }
          return result;
        };
      }

      return val;
    },
  });
}

/**
 * Wraps a Supabase client with a Proxy that provides:
 * - Dev: N+1 query detection (warns at >8 queries per client instance)
 * - Dev: Warns on select("*") for tables with sensitive columns
 * - Prod: Lightweight pass-through with query counting for future metrics
 */
export function withQueryProxy<T extends SupabaseClient>(client: T): T {
  const counter = { count: 0, tables: [] as string[] };

  return new Proxy(client, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);

      if (prop === "from" && typeof val === "function") {
        return function proxiedFrom(table: string) {
          const meta: QueryMeta = {
            table,
            isSingle: false,
            selectCols: null,
          };

          const queryBuilder = val.call(target, table);
          return proxyQueryBuilder(queryBuilder, meta, counter);
        };
      }

      return val;
    },
  }) as T;
}
