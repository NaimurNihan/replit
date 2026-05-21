import { useState, useEffect, useRef } from "react";
import { Copy, Check, StickyNote, Trash2, ChevronDown, ChevronUp, X, Download, Upload } from "lucide-react";

const LS_NOTE  = "allmail_note_v1";
const LS_CARDS = "allmail_cards_v2";
const LS_DONE  = "allmail_done_v1";
const LS_DATES = "allmail_dates_v1";

const GROUP_SIZE = 6;

interface MailCard { id: string; text: string; }

function makeId(text: string) {
  return `c-${text.toLowerCase().trim().replace(/[^a-z0-9@._-]/g, "").slice(0, 30)}`;
}

function parseAndDedupe(raw: string, existing: MailCard[] = []): MailCard[] {
  const seen = new Set(existing.map((c) => c.text.toLowerCase().trim()));
  const result: MailCard[] = [...existing];
  raw
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((text) => {
      const key = text.toLowerCase().trim();
      if (!seen.has(key)) { seen.add(key); result.push({ id: makeId(text), text }); }
    });
  return result;
}

function parseOnly(raw: string): MailCard[] {
  const seen = new Set<string>();
  const result: MailCard[] = [];
  raw
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .forEach((text) => {
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

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${copied ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 hover:bg-slate-200 text-slate-500"}`}
    >
      {copied ? <Check size={10} strokeWidth={3} /> : <Copy size={10} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function DateBox({ value, onChange, done }: { value: string; onChange: (v: string) => void; done: boolean }) {
  const [month, day] = value ? value.split("-") : ["", ""];
  const setMonth = (m: string) => onChange(m && day ? `${m}-${day}` : m ? `${m}-` : "");
  const setDay   = (d: string) => {
    const num = d.replace(/\D/g, "").slice(0, 2);
    const clamped = num && parseInt(num) > 31 ? "31" : num;
    onChange(month ? `${month}-${clamped}` : `-${clamped}`);
  };
  const displayDay = day ? day.replace("-", "") : "";
  return (
    <div className={`flex items-center gap-0.5 rounded-lg border px-1.5 py-0.5 text-[11px] font-semibold transition-all ${
      value && value !== "-"
        ? done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-400"
    }`}>
      <select value={month || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setMonth(e.target.value)}
        className="bg-transparent outline-none cursor-pointer text-[11px] font-semibold max-w-[34px]">
        <option value="">MM</option>
        {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
      </select>
      <span className="opacity-40">/</span>
      <input type="text" inputMode="numeric" maxLength={2} placeholder="DD" value={displayDay}
        onClick={(e) => e.stopPropagation()} onChange={(e) => setDay(e.target.value)}
        className="bg-transparent outline-none w-[18px] text-center text-[11px] font-mono font-semibold placeholder:text-slate-300" />
    </div>
  );
}

export default function AllMail() {
  const [note, setNote]   = useState<string>(() => localStorage.getItem(LS_NOTE) ?? "");
  const [cards, setCards] = useState<MailCard[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CARDS) ?? "[]"); } catch { return []; }
  });
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_DONE) ?? "[]")); } catch { return new Set(); }
  });
  const [dates, setDates] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_DATES) ?? "{}"); } catch { return {}; }
  });
  const [noteOpen,      setNoteOpen]      = useState(true);
  const [confirmClear,  setConfirmClear]  = useState(false);
  const [dupWarning,    setDupWarning]    = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(LS_NOTE,  note); }, [note]);
  useEffect(() => { localStorage.setItem(LS_CARDS, JSON.stringify(cards)); }, [cards]);
  useEffect(() => { localStorage.setItem(LS_DONE,  JSON.stringify([...doneIds])); }, [doneIds]);
  useEffect(() => { localStorage.setItem(LS_DATES, JSON.stringify(dates)); }, [dates]);

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

  const setDate = (id: string, val: string) =>
    setDates((prev) => ({ ...prev, [id]: val }));

  const toggleGroup = (gi: number) =>
    setCollapsedGroups((prev) => { const n = new Set(prev); n.has(gi) ? n.delete(gi) : n.add(gi); return n; });

  // ── Download ──────────────────────────────────────────────
  const handleDownload = () => {
    const lines = cards.map((c) => c.text).join("\n");
    const blob  = new Blob([lines], { type: "text/plain" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = "allmail_export.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Upload ────────────────────────────────────────────────
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw    = (ev.target?.result as string) ?? "";
      const merged = parseAndDedupe(raw, cards);
      setCards(merged);
      if (uploadRef.current) uploadRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const total     = cards.length;
  const doneCount = [...doneIds].filter((id) => cards.some((c) => c.id === id)).length;
  const groups    = chunkArray(cards, GROUP_SIZE);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* ── Note Card ───────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 select-none">
            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setNoteOpen((v) => !v)}>
              <StickyNote size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-800">Note — Paste your mails here</span>
              {total > 0 && <span className="text-[11px] bg-amber-200 text-amber-700 font-semibold px-2 py-0.5 rounded-full">{total} mails</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {doneCount > 0 && (
                <span className="text-[11px] bg-emerald-100 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>
              )}

              {/* Upload */}
              <button
                onClick={(e) => { e.stopPropagation(); uploadRef.current?.click(); }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
                title="Upload .txt file"
              >
                <Upload size={11} /> Upload
              </button>
              <input ref={uploadRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleUploadFile} />

              {/* Download */}
              {total > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                  title="Download as .txt"
                >
                  <Download size={11} /> Download
                </button>
              )}

              {/* Clear All (note only) */}
              {note && (
                confirmClear ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] text-red-500 font-medium">Clear note?</span>
                    <button onClick={clearNote} className="px-2 py-0.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Yes</button>
                    <button onClick={() => setConfirmClear(false)} className="px-2 py-0.5 text-[11px] font-semibold bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">No</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmClear(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-red-50 border border-red-200 text-red-500 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors"
                  >
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
              <textarea
                ref={textareaRef}
                value={note}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={"Paste emails here — one per line or comma separated.\nDuplicates are ignored automatically."}
                className="w-full h-36 text-sm font-mono text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-all"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-amber-500">Each line = 1 card · Clear All only clears note, cards stay · duplicates ignored</p>
                {dupWarning > 0 && (
                  <span className="text-[11px] text-orange-500 font-semibold animate-pulse">{dupWarning} duplicate{dupWarning > 1 ? "s" : ""} skipped</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats bar ───────────────────────────────────── */}
        {total > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400 font-medium">
              {total} mail{total !== 1 ? "s" : ""}
              {" · "}{groups.length} group{groups.length !== 1 ? "s" : ""}
              {doneCount > 0 && <span className="ml-2 text-emerald-500 font-semibold">· {doneCount} done · {total - doneCount} remaining</span>}
            </p>
            {doneCount > 0 && (
              <div className="flex-1 mx-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {/* ── Groups of 6 ─────────────────────────────────── */}
        {groups.map((group, gi) => {
          const startNum = gi * GROUP_SIZE + 1;
          const endNum   = startNum + group.length - 1;
          const collapsed = collapsedGroups.has(gi);
          const groupDone = group.filter((c) => doneIds.has(c.id)).length;
          const allDone   = groupDone === group.length;

          return (
            <div key={gi} className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${allDone ? "border-emerald-200" : "border-slate-200"}`}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(gi)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  allDone ? "bg-emerald-50 hover:bg-emerald-100" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${allDone ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    Group {gi + 1}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    #{String(startNum).padStart(3, "0")} – #{String(endNum).padStart(3, "0")}
                  </span>
                  {allDone && <span className="text-[11px] font-bold text-emerald-600">✓ All Done</span>}
                  {!allDone && groupDone > 0 && (
                    <span className="text-[11px] text-emerald-500">{groupDone}/{group.length} done</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* mini progress for group */}
                  <div className="w-20 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.round((groupDone / group.length) * 100)}%` }} />
                  </div>
                  {collapsed ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronUp size={13} className="text-slate-400" />}
                </div>
              </button>

              {/* Cards inside group */}
              {!collapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-slate-50 border-t border-slate-100">
                  {group.map((card, localIdx) => {
                    const globalIdx = gi * GROUP_SIZE + localIdx;
                    const done      = doneIds.has(card.id);
                    const dateVal   = dates[card.id] ?? "";
                    return (
                      <div
                        key={card.id}
                        className={`rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all shadow-sm ${
                          done ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow"
                        }`}
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {String(globalIdx + 1).padStart(3, "0")}
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            {done && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">DONE</span>}
                            <button
                              onClick={() => removeCard(card.id)}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:bg-red-100 hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <X size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>

                        {/* Mail */}
                        <p className={`text-xs font-mono break-all leading-relaxed flex-1 ${done ? "text-emerald-700 line-through opacity-60" : "text-slate-800"}`}>
                          {card.text}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                          <CopyBtn text={card.text} />
                          <DateBox value={dateVal} onChange={(v) => setDate(card.id, v)} done={done} />
                          <button
                            onClick={() => toggleDone(card.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ml-auto ${
                              done ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600"
                            }`}
                          >
                            <Check size={10} strokeWidth={3} />
                            {done ? "Done" : "Mark Done"}
                          </button>
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
            <StickyNote size={48} className="mx-auto mb-3 opacity-30 text-slate-300" />
            <p className="text-sm font-medium text-slate-400">Paste your mails in the note above</p>
            <p className="text-xs text-slate-300 mt-1">Or upload a .txt file · Each line becomes a card · Every 6 cards = 1 group</p>
          </div>
        )}
      </div>
    </div>
  );
}
