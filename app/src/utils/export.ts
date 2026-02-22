// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function downloadCSV(rows: readonly any[], filename: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((r: Record<string, unknown>) =>
      keys
        .map((k) => {
          const v = r[k];
          const s = v == null ? "" : String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : filename + ".csv");
}

export function downloadPNG(element: HTMLElement, filename: string) {
  import("dom-to-image-more").then((domtoimage) => {
    domtoimage.toBlob(element, {
      width: element.scrollWidth,
      height: element.scrollHeight,
      style: { zoom: "1" },
    }).then((blob: Blob) => {
      if (blob) triggerDownload(blob, filename.endsWith(".png") ? filename : filename + ".png");
    });
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
