import { createServiceSupabase } from "./supabase/server";

const RETENTION_DAYS = 7;

/** An error whose message is already written for staff to read as-is. */
export class UserFacingError extends Error {}

export function formatNzTime(date: Date) {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Records a failure and returns a message staff can forward as-is: what went
 * wrong in plain English, when, and a reference to find it on /admin/errors.
 * Never throws — logging must not hide the original problem.
 */
export async function reportError(input: {
  area: string;
  action: string;
  error: unknown;
  staffId?: string | null;
}): Promise<string> {
  const now = new Date();
  const known = input.error instanceof UserFacingError;
  const technical = input.error instanceof Error ? input.error.message : String(input.error);
  const summary = known
    ? technical
    : "Something unexpected went wrong. The technical details have been saved so they can be looked into.";

  let ref = "unsaved";
  try {
    const supabase = createServiceSupabase();
    const { data } = await supabase
      .from("error_log")
      .insert({
        area: input.area,
        summary: `${input.action}: ${summary}`,
        detail: known ? null : technical,
        staff_id: input.staffId ?? null,
        occurred_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (data) ref = data.id.slice(0, 8).toUpperCase();

    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("error_log").delete().lt("occurred_at", cutoff);
  } catch (err) {
    console.error("[error-log] could not save", err);
  }
  console.error(`[${input.area}] ${input.action} failed (ref ${ref})`, input.error);

  return `${input.action}. ${summary} (BrandSource, ${formatNzTime(now)}, ref ${ref}. Forward this message to Lloyd.)`;
}
