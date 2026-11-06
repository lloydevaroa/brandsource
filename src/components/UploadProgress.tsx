/** A progress bar for a file upload in progress, so the page never looks stuck. */
export function UploadProgress({
  fileName,
  percent,
  position,
}: {
  fileName: string;
  percent: number;
  /** "2 of 3" when several files are queued. */
  position?: string;
}) {
  const saving = percent >= 100;
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-zinc-800">
          {saving ? "Saving" : "Uploading"} {fileName}
          {position ? <span className="font-normal text-zinc-500"> ({position})</span> : null}
        </span>
        <span className="shrink-0 tabular-nums text-zinc-600">{saving ? "Almost done" : `${percent}%`}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={`h-full rounded-full bg-brand-orange transition-[width] duration-200 ${saving ? "animate-pulse" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">Keep this page open until it finishes.</p>
    </div>
  );
}
