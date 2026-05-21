import { useState, useMemo } from "react";
import { outlookData, OutlookEntry } from "@/data/outlookData";
import { Copy, Check, ChevronRight, Mail, Search, X } from "lucide-react";

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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
      title={`Copy ${label || "value"}`}
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function EntryRow({
  entry,
  selected,
  onClick,
}: {
  entry: OutlookEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-slate-100 transition-colors select-none ${
        selected
          ? "bg-blue-50 border-l-2 border-l-blue-500"
          : "hover:bg-slate-50 border-l-2 border-l-transparent"
      }`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"}`}>
        {entry.email[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-mono truncate ${selected ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
          {entry.email}
        </p>
      </div>
      <ChevronRight size={12} className={`shrink-0 ${selected ? "text-blue-400" : "text-slate-300 group-hover:text-slate-400"}`} />
    </div>
  );
}

function FieldRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <CopyButton text={value} label={label} />
      </div>
      <p className={`text-sm text-slate-800 break-all leading-relaxed ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<OutlookEntry | null>(outlookData[0]);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return outlookData;
    const q = search.toLowerCase();
    return outlookData.filter((e) => e.email.toLowerCase().includes(q));
  }, [search]);

  const copyAll = () => {
    if (!selected) return;
    const text = `${selected.email}|${selected.password}|${selected.cookie}|${selected.uuid}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Mail size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Outlook Separator</h1>
            <p className="text-xs text-slate-400">{outlookData.length} accounts</p>
          </div>
        </div>
        <div className="ml-auto text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
          email | password | cookie | uuid
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-57px)]">
        {/* LEFT PANEL — email list */}
        <div className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-1.5">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
          {/* Count */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] text-slate-400 font-medium">
              {filtered.length} of {outlookData.length} accounts
            </span>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">No results</div>
            ) : (
              filtered.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  selected={selected?.id === entry.id}
                  onClick={() => setSelected(entry)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL — full details */}
        <div className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Mail size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Select an account to view details</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Detail header */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                    {selected.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 font-mono">{selected.email}</p>
                    <p className="text-xs text-slate-400">Account #{selected.id}</p>
                  </div>
                </div>
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Copy size={12} />
                  Copy Full Line
                </button>
              </div>

              {/* Raw line */}
              <div className="bg-slate-900 rounded-xl p-4 mb-4 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">Raw Format</span>
                  <CopyButton
                    text={`${selected.email}|${selected.password}|${selected.cookie}|${selected.uuid}`}
                    label="raw line"
                  />
                </div>
                <p className="text-xs font-mono text-emerald-400 break-all leading-relaxed">
                  <span className="text-blue-300">{selected.email}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-yellow-300">{selected.password}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-purple-300 opacity-70">{selected.cookie.slice(0, 40)}...</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-pink-300">{selected.uuid}</span>
                </p>
              </div>

              {/* Fields */}
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
