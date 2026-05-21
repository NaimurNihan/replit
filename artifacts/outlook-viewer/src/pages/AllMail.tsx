import { useState, useEffect, useRef } from "react";
import { Copy, Check, StickyNote, Trash2, ChevronDown, ChevronUp, X, Download, Upload, Zap } from "lucide-react";

const LS_NOTE  = "allmail_note_v1";
const LS_CARDS = "allmail_cards_v2";
const LS_DONE  = "allmail_done_v1";
const LS_DAYS  = "allmail_days_v1";

const GROUP_SIZE = 6;

interface MailCard { id: string; text: string; }

function makeId(text: string) {
  return `c-${text.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, "").slice(0, 30)}`;
}

function parseOnly(raw: string): MailCard[] {
  const seen = new Set<string>();
  const result: MailCard[] = [];
  raw.split(/[\n,;]+/).map((l) => l.trim()).filter((l) => l.length > 0).forEach((text) => {
    const key = text.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); result.push({ id: makeId(text), text }); }
  });
  return result;
}

function parseAndMerge(raw: string, existing: MailCard[]): MailCard[] {
  const seen = new Set(existing.map((c) => c.text.toLowerCase().trim()));
  const result: MailCard[] = [...existing];
  raw.split(/[\n,;]+/).map((l) => l.trim()).filter((l) => l.length > 0).forEach((text) => {
    const key = text.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); result.push({ id: makeId(text), text }); }
  });
  return result;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CopyBtn({ text, dark }: { text: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
        copied
          ? "bg-emerald-500 text-white"
          : dark
            ? "bg-white/10 hover:bg-white/20 text-white/70"
            : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300"
      }`}
    >
      {copied ? <Check size={10} strokeWidth={3} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DaysInput({
  value, onChange, inactive, dark,
}: { value: string; onChange: (v: string) => void; inactive: boolean; dark: boolean }) {
  const n   = parseInt(value);
  const due = !isNaN(n) && n > 0 ? addDays(n) : null;
  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-all ${
      inactive
        ? "border-white/20 bg-white/10"
        : due
          ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
          : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
    }`}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={3}
        placeholder="days"
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={`bg-transparent outline-none w-[28px] text-center text-[11px] font-mono font-bold placeholder:font-normal ${
          inactive ? "text-white/70 placeholder:text-white/30" : due ? "text-orange-600 dark:text-orange-400 placeholder:text-slate-300" : "text-slate-400 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600"
        }`}
      />
      {due && (
        <span className={`text-[10px] font-semibold whitespace-nowrap ${inactive ? "text-white/60" : "text-orange-500 dark:text-orange-400"}`}>
          → {due}
        </span>
      )}
    </div>
  );
}

export default function AllMail() {
  const [note,   setNote]   = useState<string>(() => localStorage.getItem(LS_NOTE)  ?? "");
  const [cards,  setCards]  = useState<MailCard[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CARDS) ?? "[]"); } catch { return []; }
  });
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_DONE) ?? "[]")); } catch { return new Set(); }
  });
  const [days, setDays] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_DAYS) ?? "{}"); } catch { return {}; }
  });

  const [noteOpen,        setNoteOpen]        = useState(true);
  const [confirmClear,    setConfirmClear]    = useState(false);
  const [dupWarning,      setDupWarning]      = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(LS_NOTE,  note); },                       [note]);
  useEffect(() => { localStorage.setItem(LS_CARDS, JSON.stringify(cards)); },      [cards]);
  useEffect(() => { localStorage.setItem(LS_DONE,  JSON.stringify([...doneIds])); }, [doneIds]);
  useEffect(() => { localStorage.setItem(LS_DAYS,  JSON.stringify(days)); },       [days]);

  const handleNoteChange = (val: string) => {
    setNote(val);
    const parsed   = parseOnly(val);
    const existing = new Set(cards.map((c) => c.text.toLowerCase().trim()));
    const dupes    = parsed.filter((c) => existing.has(c.text.toLowerCase().trim())).length;
    if (dupes > 0) { setDupWarning(dupes); setTimeout(() => setDupWarning(0), 2500); }
    setCards(parseOnly(val));
  };

  const clearNote = () => { setNote(""); setConfirmClear(false); };

  const removeCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  const toggleDone = (id: string) =>
    setDoneIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setDayVal = (id: string, val: string) =>
    setDays((prev) => ({ ...prev, [id]: val }));

  const activateCard = (id: string) =>
    setDays((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const toggleGroup = (gi: number) =>
    setCollapsedGroups((prev) => { const n = new Set(prev); n.has(gi) ? n.delete(gi) : n.add(gi); return n; });

  const handleDownload = () => {
    const blob = new Blob([cards.map((c) => c.text).join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "allmail_export.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCards(parseAndMerge((ev.target?.result as string) ?? "", cards));
      if (uploadRef.current) uploadRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const total     = cards.length;
  const doneCount = [...doneIds].filter((id) => cards.some((c) => c.id === id)).length;
  const groups    = chunkArray(cards, GROUP_SIZE);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">

      {/* Top header bar */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">All Mail</span>
          {total > 0 && <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full">{total} cards</span>}
          {doneCount > 0 && <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Upload size={12} /> Upload
          </button>
          <input ref={uploadRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleUploadFile} />
          <button
            onClick={handleDownload}
            disabled={total === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Download size={12} /> Download
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* Note card */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 select-none">
            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setNoteOpen((v) => !v)}>
              <StickyNote size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Note — Paste your mails here</span>
              {total > 0 && <span className="text-[11px] bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">{total} mails</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {doneCount > 0 && <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>}
              {note && (
                confirmClear ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] text-red-500 font-medium">Clear note?</span>
                    <button onClick={clearNote} className="px-2 py-0.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg">Yes</button>
                    <button onClick={() => setConfirmClear(false)} className="px-2 py-0.5 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">No</button>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmClear(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                    <Trash2 size={11} /> Clear All
                  </button>
                )
              )}
              <div className="cursor-pointer" onClick={() => setNoteOpen((v) => !v)}>
                {noteOpen ? <ChevronUp size={14} className="text-amber-400" /> : <ChevronDown size={14} className="text-amber-400" />}
              </div>
            </div>
          </div>
          {noteOpen && (
            <div className="px-4 pb-4">
              <textarea ref={textareaRef} value={note} onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={"Paste emails here — one per line or comma separated.\nDuplicates are ignored automatically."}
                className="w-full h-36 text-sm font-mono text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-amber-300 dark:placeholder:text-amber-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800 transition-all" />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-amber-500 dark:text-amber-600">Each line = 1 card · Clear All only clears note, cards stay · duplicates ignored</p>
                {dupWarning > 0 && <span className="text-[11px] text-orange-500 font-semibold animate-pulse">{dupWarning} duplicate{dupWarning > 1 ? "s" : ""} skipped</span>}
              </div>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {total > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {total} mail{total !== 1 ? "s" : ""} · {groups.length} group{groups.length !== 1 ? "s" : ""}
              {doneCount > 0 && <span className="ml-2 text-emerald-500 font-semibold">· {doneCount} done · {total - doneCount} remaining</span>}
            </p>
            {doneCount > 0 && (
              <div className="flex-1 mx-4 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Groups of 6 */}
        {groups.map((group, gi) => {
          const startNum  = gi * GROUP_SIZE + 1;
          const endNum    = startNum + group.length - 1;
          const collapsed = collapsedGroups.has(gi);
          const groupDone = group.filter((c) => doneIds.has(c.id)).length;
          const allDone   = groupDone === group.length;

          return (
            <div key={gi} className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${allDone ? "border-emerald-200 dark:border-emerald-800" : "border-slate-200 dark:border-slate-700"}`}>
              {/* Group header */}
              <button onClick={() => toggleGroup(gi)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${allDone ? "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${allDone ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                    Group {gi + 1}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">#{String(startNum).padStart(3, "0")} – #{String(endNum).padStart(3, "0")}</span>
                  {allDone && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ All Done</span>}
                  {!allDone && groupDone > 0 && <span className="text-[11px] text-emerald-500">{groupDone}/{group.length} done</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.round((groupDone / group.length) * 100)}%` }} />
                  </div>
                  {collapsed ? <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" /> : <ChevronUp size={13} className="text-slate-400 dark:text-slate-500" />}
                </div>
              </button>

              {/* Cards */}
              {!collapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
                  {group.map((card, localIdx) => {
                    const globalIdx = gi * GROUP_SIZE + localIdx;
                    const done      = doneIds.has(card.id);
                    const dayVal    = days[card.id] ?? "";
                    const inactive  = dayVal.length > 0;
                    const daysNum   = parseInt(dayVal);
                    const dueDate   = !isNaN(daysNum) && daysNum > 0 ? addDays(daysNum) : null;

                    return (
                      <div key={card.id}
                        className={`rounded-xl border flex flex-col gap-0 transition-all shadow-sm overflow-hidden ${
                          inactive
                            ? "bg-gray-950 border-gray-800"
                            : done
                              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow"
                        }`}
                      >
                        {/* INACTIVE top bar */}
                        {inactive && (
                          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/40 font-mono">INACTIVE</span>
                              {dueDate && (
                                <span className="text-[10px] font-bold text-orange-400 bg-orange-400/15 px-1.5 py-0.5 rounded-md">
                                  📅 {dueDate}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => activateCard(card.id)}
                              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors"
                            >
                              <Zap size={9} strokeWidth={2.5} /> Active
                            </button>
                          </div>
                        )}

                        <div className="p-3.5 flex flex-col gap-2.5 flex-1">
                          {/* Top row: number + done badge + X */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              inactive ? "bg-white/10 text-white/50" : done ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                            }`}>
                              {String(globalIdx + 1).padStart(3, "0")}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              {done && !inactive && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">DONE</span>}
                              <button onClick={() => removeCard(card.id)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                  inactive ? "text-white/20 hover:bg-white/10 hover:text-white/60" : "text-slate-300 dark:text-slate-600 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500"
                                }`}>
                                <X size={11} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>

                          {/* Mail text */}
                          <p className={`text-xs font-mono break-all leading-relaxed flex-1 ${
                            inactive ? "text-white/80" : done ? "text-emerald-700 dark:text-emerald-400 line-through opacity-60" : "text-slate-800 dark:text-slate-200"
                          }`}>
                            {card.text}
                          </p>

                          {/* Actions */}
                          <div className={`flex items-center gap-1.5 pt-2 border-t ${inactive ? "border-white/10" : "border-slate-100 dark:border-slate-700"}`}>
                            <CopyBtn text={card.text} dark={inactive} />
                            <DaysInput value={dayVal} onChange={(v) => setDayVal(card.id, v)} inactive={inactive} dark={inactive} />
                            {!inactive && (
                              <button onClick={() => toggleDone(card.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ml-auto ${
                                  done ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                                }`}>
                                <Check size={10} strokeWidth={3} />
                                {done ? "Done" : "Mark Done"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {total === 0 && (
          <div className="text-center py-20">
            <StickyNote size={48} className="mx-auto mb-3 opacity-30 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Paste your mails in the note above</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Or upload a .txt file · Every 6 cards = 1 group · Type days to schedule</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
