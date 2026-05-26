import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { outlookData as defaultData, OutlookEntry } from "@/data/outlookData";
import { Copy, Check, ChevronRight, Mail, Search, X, Upload, Download, Trash2, ExternalLink } from "lucide-react";

const LS_ENTRIES = "outlook_entries_v1";
const LS_DONE = "outlook_done_v1";
const LS_SELECTED = "outlook_selected_id_v1";

function loadEntries(): OutlookEntry[] {
  try {
    const raw = localStorage.getItem(LS_ENTRIES);
    if (raw) return JSON.parse(raw) as OutlookEntry[];
  } catch {}
  return defaultData;
}

function loadDoneIds(): Set<number> {
  try {
    const raw = localStorage.getItem(LS_DONE);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set();
}

function loadSelectedId(entries: OutlookEntry[]): OutlookEntry | null {
  try {
    const raw = localStorage.getItem(LS_SELECTED);
    if (raw) {
      const id = JSON.parse(raw) as number;
      return entries.find((e) => e.id === id) ?? entries[0] ?? null;
    }
  } catch {}
  return entries[0] ?? null;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
      title={`Copy ${label || "value"}`}
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function EntryRow({
  entry,
  index,
  selected,
  done,
  onClick,
  onToggleDone,
}: {
  entry: OutlookEntry;
  index: number;
  selected: boolean;
  done: boolean;
  onClick: () => void;
  onToggleDone: (e: React.MouseEvent) => void;
}) {
  const num = String(index + 1).padStart(3, "0");
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-2 py-2.5 cursor-pointer border-b transition-colors select-none ${
        selected
          ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500 border-b-slate-100 dark:border-b-slate-700"
          : done
          ? "bg-emerald-50/60 dark:bg-emerald-900/20 border-l-2 border-l-emerald-400 border-b-slate-100 dark:border-b-slate-700"
          : "hover:bg-slate-50 dark:hover:bg-slate-800 border-l-2 border-l-transparent border-b-slate-100 dark:border-b-slate-700"
      }`}
    >
      <span className={`text-[10px] font-mono font-bold shrink-0 w-7 text-right ${done ? "text-emerald-500" : selected ? "text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>
        {num}
      </span>
      <button
        onClick={onToggleDone}
        title={done ? "Mark as pending" : "Mark as done"}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-slate-300 dark:border-slate-600 hover:border-emerald-400 text-transparent hover:text-emerald-300"
        }`}
      >
        <Check size={10} strokeWidth={3} />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-mono truncate ${done ? "text-emerald-700 dark:text-emerald-400 line-through opacity-70" : selected ? "text-blue-700 dark:text-blue-300 font-semibold" : "text-slate-700 dark:text-slate-300"}`}>
          {entry.email}
        </p>
      </div>
      <ChevronRight size={12} className={`shrink-0 ${selected ? "text-blue-400" : "text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500"}`} />
    </div>
  );
}

function FieldRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <CopyButton text={value} label={label} />
      </div>
      <p className={`text-sm text-slate-800 dark:text-slate-200 break-all leading-relaxed ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function parseXlsxData(buffer: ArrayBuffer): Promise<OutlookEntry[]> {
  return import("xlsx").then((XLSX) => {
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
    const entries: OutlookEntry[] = [];
    rows.forEach((row, i) => {
      const cell = row[0];
      if (!cell) return;
      const parts = String(cell).split("|");
      if (!parts[0] || !parts[0].includes("@")) return;
      entries.push({
        id: i + 1,
        email: parts[0].trim(),
        password: parts[1] || "",
        cookie: parts[2] || "",
        uuid: parts[3] || "",
      });
    });
    return entries;
  });
}

export default function Home() {
  const [entries, setEntries] = useState<OutlookEntry[]>(() => loadEntries());
  const [selected, setSelected] = useState<OutlookEntry | null>(() => loadSelectedId(loadEntries()));
  const [search, setSearch] = useState("");
  const [doneIds, setDoneIds] = useState<Set<number>>(() => loadDoneIds());
  const [uploading, setUploading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(LS_DONE, JSON.stringify([...doneIds]));
  }, [doneIds]);

  useEffect(() => {
    if (selected) localStorage.setItem(LS_SELECTED, JSON.stringify(selected.id));
  }, [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.email.toLowerCase().includes(q));
  }, [search, entries]);

  const doneCount = doneIds.size;

  const copyAll = () => {
    if (!selected) return;
    navigator.clipboard.writeText(
      `${selected.email}|${selected.password}|${selected.cookie}|${selected.uuid}`
    );
  };

  const toggleDone = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseXlsxData(buffer);
      if (parsed.length === 0) { alert("No valid email entries found in this file."); return; }
      setEntries(parsed);
      setSelected(parsed[0]);
      setDoneIds(new Set());
      setSearch("");
    } catch {
      alert("Failed to read file. Make sure it's a valid .xlsx file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = () => {
    const lines = entries.map((e) => `${e.email}|${e.password}|${e.cookie}|${e.uuid}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outlook_accounts.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearStorage = () => {
    localStorage.removeItem(LS_ENTRIES);
    localStorage.removeItem(LS_DONE);
    localStorage.removeItem(LS_SELECTED);
    setEntries(defaultData);
    setSelected(defaultData[0]);
    setDoneIds(new Set());
    setSearch("");
    setConfirmReset(false);
  };

  const handleClearAll = () => {
    localStorage.removeItem(LS_ENTRIES);
    localStorage.removeItem(LS_DONE);
    localStorage.removeItem(LS_SELECTED);
    setEntries([]);
    setSelected(null);
    setDoneIds(new Set());
    setSearch("");
    setConfirmClearAll(false);
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Mail size={16} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">Outlook Separator</h1>
              <a
                href="https://dongvanfb.net/read_mail_box/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors truncate max-w-[260px]"
                title="https://dongvanfb.net/read_mail_box/"
              >
                <ExternalLink size={10} className="shrink-0" />
                https://dongvanfb.net/read_mail_box/
              </a>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {entries.length} accounts
              {doneCount > 0 && <span className="ml-1.5 text-emerald-500 font-semibold">· {doneCount} done</span>}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Clear All */}
          {confirmClearAll ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-500 font-medium">Clear all?</span>
              <button onClick={handleClearAll} className="px-2 py-1 text-[11px] font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Yes</button>
              <button onClick={() => setConfirmClearAll(false)} className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <Trash2 size={11} /> Clear All
            </button>
          )}

          {/* Reset */}
          {confirmReset ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-500 font-medium">Reset?</span>
              <button onClick={handleClearStorage} className="px-2 py-1 text-[11px] font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Yes</button>
              <button onClick={() => setConfirmReset(false)} className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-colors"
            >
              <X size={11} /> Reset
            </button>
          )}

          {/* Upload */}
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer transition-colors ${uploading ? "bg-slate-100 dark:bg-slate-800 text-slate-400" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}
          >
            <Upload size={13} />
            {uploading ? "Loading..." : "Upload"}
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Download size={13} />
            Download All
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT PANEL */}
        <div className="w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><X size={11} /></button>
              )}
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{filtered.length} of {entries.length}</span>
            {doneCount > 0 && <span className="text-[10px] text-emerald-500 font-semibold">✓ {doneCount} done</span>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 text-xs">No results</div>
            ) : (
              filtered.map((entry, idx) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={idx}
                  selected={selected?.id === entry.id}
                  done={doneIds.has(entry.id)}
                  onClick={() => setSelected(entry)}
                  onToggleDone={(e) => toggleDone(e, entry.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-950">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
              <Mail size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Select an account to view details</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className={`border rounded-xl p-4 mb-4 flex items-center justify-between ${doneIds.has(selected.id) ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${doneIds.has(selected.id) ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600"}`}>
                    {doneIds.has(selected.id) ? <Check size={20} strokeWidth={3} /> : selected.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">{selected.email}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Account #{String(entries.findIndex((e) => e.id === selected.id) + 1).padStart(3, "0")}
                      </p>
                      {doneIds.has(selected.id) && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">DONE</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDoneIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(selected.id)) next.delete(selected.id); else next.add(selected.id);
                      return next;
                    })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      doneIds.has(selected.id)
                        ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600"
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                    {doneIds.has(selected.id) ? "Done ✓" : "Mark Done"}
                  </button>
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Copy size={12} />
                    Copy Full Line
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 mb-4 border border-slate-700 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">Raw Format</span>
                  <CopyButton text={`${selected.email}|${selected.password}|${selected.cookie}|${selected.uuid}`} label="raw line" />
                </div>
                <p className="text-xs font-mono break-all leading-relaxed">
                  <span className="text-blue-300">{selected.email}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-yellow-300">{selected.password}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-purple-300 opacity-70">{selected.cookie.slice(0, 40)}...</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-pink-300">{selected.uuid}</span>
                </p>
              </div>

              <div className="space-y-3">
                <FieldRow label="Email" value={selected.email} />
                <FieldRow label="Password" value={selected.password} />
                <FieldRow label="Cookie" value={selected.cookie} />
                <FieldRow label="UUID" value={selected.uuid} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
