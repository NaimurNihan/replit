import { useState, useEffect, useRef, useMemo } from "react";
import { Copy, Check, StickyNote, Trash2, ChevronDown, ChevronUp, X, Download, Upload, Zap, Clock, Calendar, Eye, EyeOff } from "lucide-react";

const LS_NOTE       = "allmail_note_v1";
const LS_CARDS      = "allmail_cards_v2";
const LS_DONE       = "allmail_done_v1";
const LS_COPIED     = "allmail_copied_v1"; // permanently green after copy
const LS_DUEDATES   = "allmail_duedates_v2"; // values = "YYYY-MM-DD" ISO strings
const LS_SAVED_NOTE = "allmail_saved_note_v1"; // the note text that was last saved to cards

const GROUP_SIZE = 6;

interface MailCard { id: string; text: string; }

// ── Date helpers ────────────────────────────────────────────
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO string for today: "YYYY-MM-DD" */
function todayISO(): string {
  return todayMidnight().toISOString().split("T")[0];
}

/** Compute ISO due date = today + n days */
function nDaysFromTodayISO(n: number): string {
  const d = todayMidnight();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

/** Days remaining from today to an ISO date string (negative = overdue) */
function daysLeftFromISO(iso: string): number {
  const due = new Date(iso + "T00:00:00");
  return Math.round((due.getTime() - todayMidnight().getTime()) / 86400000);
}

/** Format ISO date as "May 26" */
function formatISO(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Migrate old storage: if value is a plain number string, convert to ISO date (today + n) */
function migrateOldDays(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^\d+$/.test(v)) {
      const n = parseInt(v);
      if (n > 0) out[k] = nDaysFromTodayISO(n);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      out[k] = v;
    }
  }
  return out;
}

// ── Parsing helpers ─────────────────────────────────────────
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

// ── Sub-components ──────────────────────────────────────────
function CopyBtn({ text, dark, onCopy }: { text: string; dark?: boolean; onCopy?: () => void }) {
  const [flash, setFlash] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setFlash(true);
        setTimeout(() => setFlash(false), 800);
        onCopy?.();
      }}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
        flash
          ? "bg-emerald-500 text-white"
          : dark
            ? "bg-white/10 hover:bg-white/20 text-white/70"
            : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300"
      }`}
    >
      {flash ? <Check size={10} strokeWidth={3} /> : <Copy size={10} />}
      {flash ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * DaysInput — stores an ISO due date, displays days remaining (decreases day by day).
 * value: ISO date string "YYYY-MM-DD" or "".
 * onChange: called with new ISO date string or "" to clear.
 */
function DaysInput({
  value, onChange, inactive, dark,
}: { value: string; onChange: (v: string) => void; inactive: boolean; dark: boolean }) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState("");

  const daysLeft = value ? daysLeftFromISO(value) : null;
  const dueLabel = value ? formatISO(value) : null;

  // What to display in the input box
  const displayVal = editing ? draft : (daysLeft !== null ? String(daysLeft) : "");

  const hasDue = daysLeft !== null;

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    setDraft(cleaned);
    const n = parseInt(cleaned);
    if (!isNaN(n) && n > 0) {
      onChange(nDaysFromTodayISO(n));
    } else if (cleaned === "") {
      onChange("");
    }
  };

  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 transition-all ${
      inactive
        ? "border-white/20 bg-white/10"
        : hasDue
          ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
          : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
    }`}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={3}
        placeholder="days"
        value={displayVal}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => {
          setEditing(true);
          setDraft(daysLeft !== null ? String(daysLeft) : "");
        }}
        onBlur={() => setEditing(false)}
        onChange={(e) => handleChange(e.target.value)}
        className={`bg-transparent outline-none w-[28px] text-center text-[11px] font-mono font-bold placeholder:font-normal ${
          inactive
            ? "text-white/70 placeholder:text-white/30"
            : hasDue
              ? "text-orange-600 dark:text-orange-400 placeholder:text-slate-300"
              : "text-slate-400 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600"
        }`}
      />
      {dueLabel && (
        <span className={`text-[10px] font-semibold whitespace-nowrap ${inactive ? "text-white/60" : "text-orange-500 dark:text-orange-400"}`}>
          → {dueLabel}
        </span>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function AllMail() {
  const [note,   setNote]   = useState<string>(() => localStorage.getItem(LS_NOTE) ?? "");
  const [cards,  setCards]  = useState<MailCard[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CARDS) ?? "[]"); } catch { return []; }
  });
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_DONE) ?? "[]")); } catch { return new Set(); }
  });
  const [copiedIds, setCopiedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_COPIED) ?? "[]")); } catch { return new Set(); }
  });

  // dueDates: Record<cardId, "YYYY-MM-DD">
  const [dueDates, setDueDates] = useState<Record<string, string>>(() => {
    try {
      // Try new key first
      const raw = localStorage.getItem(LS_DUEDATES);
      if (raw) return JSON.parse(raw);
      // Migrate from old numeric key
      const oldRaw = localStorage.getItem("allmail_days_v1");
      if (oldRaw) return migrateOldDays(JSON.parse(oldRaw));
      return {};
    } catch { return {}; }
  });

  // savedNote = the note text that was last committed to cards
  const [savedNote, setSavedNote] = useState<string>(
    () => localStorage.getItem(LS_SAVED_NOTE) ?? localStorage.getItem(LS_NOTE) ?? ""
  );

  const [noteOpen,          setNoteOpen]          = useState(true);
  const [confirmClear,      setConfirmClear]      = useState(false);
  const [confirmDeleteAll,  setConfirmDeleteAll]  = useState(false);
  const [dupWarning,        setDupWarning]        = useState(0);
  const [collapsedGroups,   setCollapsedGroups]   = useState<Set<number>>(new Set());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(LS_NOTE,       note); },                              [note]);
  useEffect(() => { localStorage.setItem(LS_SAVED_NOTE, savedNote); },                        [savedNote]);
  useEffect(() => { localStorage.setItem(LS_CARDS,      JSON.stringify(cards)); },            [cards]);
  useEffect(() => { localStorage.setItem(LS_DONE,       JSON.stringify([...doneIds])); },     [doneIds]);
  useEffect(() => { localStorage.setItem(LS_COPIED,     JSON.stringify([...copiedIds])); },   [copiedIds]);
  useEffect(() => { localStorage.setItem(LS_DUEDATES,   JSON.stringify(dueDates)); },         [dueDates]);

  // note typing only saves text — does NOT update cards
  const handleNoteChange = (val: string) => { setNote(val); };

  // Save button: commit note → cards
  const handleSaveNote = () => {
    const parsed   = parseOnly(note);
    const existing = new Set(cards.map((c) => c.text.toLowerCase().trim()));
    const dupes    = parsed.filter((c) => existing.has(c.text.toLowerCase().trim())).length;
    if (dupes > 0) { setDupWarning(dupes); setTimeout(() => setDupWarning(0), 2500); }
    setCards(parsed);
    setSavedNote(note);
  };

  // unsaved = note text differs from what was last committed
  const hasUnsaved = note.trim() !== savedNote.trim();

  const clearNote    = () => { setNote(""); setSavedNote(""); setConfirmClear(false); };

  const handleDeleteAll = () => {
    setCards([]);
    setDoneIds(new Set());
    setCopiedIds(new Set());
    setDueDates({});
    setNote("");
    setSavedNote("");
    setCollapsedGroups(new Set());
    setConfirmDeleteAll(false);
  };
  const markCopied   = (id: string) => setCopiedIds((prev) => new Set([...prev, id]));
  const unmarkCopied = (id: string) => setCopiedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  const removeCard   = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));
  const toggleDone   = (id: string) =>
    setDoneIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setDueDate   = (id: string, iso: string) =>
    setDueDates((prev) => iso ? { ...prev, [id]: iso } : (() => { const n = { ...prev }; delete n[id]; return n; })());
  const activateCard = (id: string) =>
    setDueDates((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const toggleGroup  = (gi: number) =>
    setCollapsedGroups((prev) => { const n = new Set(prev); n.has(gi) ? n.delete(gi) : n.add(gi); return n; });

  const handleDownload = () => {
    const payload = {
      cards,
      doneIds: [...doneIds],
      dueDates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "allmail_export.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = (ev.target?.result as string) ?? "";
      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.cards && Array.isArray(parsed.cards)) {
            setCards(parsed.cards);
            if (Array.isArray(parsed.doneIds)) setDoneIds(new Set(parsed.doneIds));
            if (parsed.dueDates && typeof parsed.dueDates === "object") setDueDates(parsed.dueDates);
          }
        } catch { /* ignore malformed JSON */ }
      } else {
        setCards(parseAndMerge(raw, cards));
      }
      if (uploadRef.current) uploadRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const total     = cards.length;
  const doneCount = [...doneIds].filter((id) => cards.some((c) => c.id === id)).length;
  const groups    = chunkArray(cards, GROUP_SIZE);

  // all groups open = none in the collapsed set
  const allExpanded = groups.length > 0 && collapsedGroups.size === 0;
  const toggleAllGroups = () => {
    if (allExpanded) {
      setCollapsedGroups(new Set(groups.map((_, i) => i)));
    } else {
      setCollapsedGroups(new Set());
    }
  };

  // Top 20 sidebar cards — uses real calendar countdown
  const closestCards = useMemo(() => {
    return cards
      .map((card, idx) => {
        const iso = dueDates[card.id];
        if (!iso) return null;
        const daysLeft = daysLeftFromISO(iso);
        return { card, globalIdx: idx, daysLeft, iso };
      })
      .filter((x): x is { card: MailCard; globalIdx: number; daysLeft: number; iso: string } => x !== null)
      .sort((a, b) => {
        if (a.daysLeft <= 0 && b.daysLeft > 0) return -1;
        if (b.daysLeft <= 0 && a.daysLeft > 0) return 1;
        return a.daysLeft - b.daysLeft;
      })
      .slice(0, 20);
  }, [cards, dueDates]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">

      {/* ── Top header bar ──────────────────────────────── */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">All Mail</span>
          {total > 0 && <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-full">{total} cards</span>}
          {doneCount > 0 && <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={toggleAllGroups}
              title={allExpanded ? "Collapse all groups" : "Expand all groups"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm border ${
                allExpanded
                  ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {allExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
              {allExpanded ? "Hide All" : "Show All"}
            </button>
          )}
          <button onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Upload size={12} /> Upload
          </button>
          <input ref={uploadRef} type="file" accept=".txt,.csv,.json" className="hidden" onChange={handleUploadFile} />
          <button onClick={handleDownload} disabled={total === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
            <Download size={12} /> Download
          </button>
          {total > 0 && (
            <button onClick={() => setConfirmDeleteAll(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">
              <Trash2 size={12} /> Delete All
            </button>
          )}
        </div>
      </header>

      {/* ── Delete All Confirmation Modal ──────────────── */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Delete All Groups?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This will permanently remove all cards, done marks, and due dates.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                No
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: sidebar + main ──────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT SIDEBAR */}
        <div className="w-52 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 shrink-0">
            <Clock size={13} className="text-orange-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Closest Due</span>
            {closestCards.length > 0 && (
              <span className="ml-auto text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded-full">
                {closestCards.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {closestCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 px-3 text-center">
                <Calendar size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  No scheduled cards yet.<br />Type days on any card.
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {(() => {
                  const overdueItems  = closestCards.filter(x => x.daysLeft <= 0);
                  const upcomingItems = closestCards.filter(x => x.daysLeft > 0);

                  const renderCard = (
                    item: typeof closestCards[0],
                    isOverdue: boolean,
                    upcomingRank: number,
                  ) => {
                    const { card, globalIdx, daysLeft, iso } = item;
                    const isTop3   = !isOverdue && upcomingRank < 3;
                    const urgency  = isOverdue ? "over"
                      : isTop3       ? "green"
                      : daysLeft <= 7  ? "orange"
                      : daysLeft <= 14 ? "yellow"
                      : "slate";

                    const bgClass =
                      urgency === "over"   ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700" :
                      urgency === "green"  ? "bg-emerald-50 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700" :
                      urgency === "orange" ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" :
                      urgency === "yellow" ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" :
                                            "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
                    const numClass =
                      urgency === "over"   ? "bg-red-200 dark:bg-red-900/60 text-red-700 dark:text-red-300" :
                      urgency === "green"  ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300" :
                      urgency === "orange" ? "bg-orange-200 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300" :
                      urgency === "yellow" ? "bg-yellow-200 dark:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300" :
                                            "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400";
                    const dayClass =
                      urgency === "over"   ? "text-red-600 dark:text-red-400 font-extrabold" :
                      urgency === "green"  ? "text-emerald-600 dark:text-emerald-400 font-bold" :
                      urgency === "orange" ? "text-orange-600 dark:text-orange-400 font-bold" :
                      urgency === "yellow" ? "text-yellow-600 dark:text-yellow-400 font-bold" :
                                            "text-slate-500 dark:text-slate-400";
                    return (
                      <div key={card.id} className={`rounded-lg border px-2.5 py-2 ${bgClass}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${numClass}`}>
                            #{String(globalIdx + 1).padStart(3, "0")}
                          </span>
                          {isOverdue ? (
                            <span className="text-[9px] font-extrabold text-white bg-red-500 dark:bg-red-600 px-1.5 py-0.5 rounded animate-pulse">
                              OVER DATE
                            </span>
                          ) : (
                            <span className={`text-[10px] ${dayClass}`}>
                              {daysLeft === 1 ? "1 day" : `${daysLeft}d`}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] font-mono truncate leading-relaxed ${isOverdue ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-400"}`}>
                          {card.text}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar size={9} className={`shrink-0 ${isOverdue ? "text-red-400" : "text-slate-400 dark:text-slate-500"}`} />
                          <span className={`text-[10px] font-medium ${isOverdue ? "text-red-500 dark:text-red-400 line-through" : "text-slate-400 dark:text-slate-500"}`}>
                            {formatISO(iso)}
                          </span>
                          {isTop3 && (
                            <span className="ml-auto text-[9px] font-bold text-white bg-emerald-500 px-1 py-0.5 rounded">
                              #{upcomingRank + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {overdueItems.length > 0 && (
                        <>
                          <p className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest px-1">⚠ Overdue</p>
                          {overdueItems.map((item, i) => renderCard(item, true, -1))}
                          {upcomingItems.length > 0 && <div className="border-t border-slate-200 dark:border-slate-700 my-1" />}
                        </>
                      )}
                      {upcomingItems.length > 0 && (
                        <>
                          {overdueItems.length > 0 && <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1">✦ Upcoming</p>}
                          {upcomingItems.map((item, i) => renderCard(item, false, i))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

            {/* ── Note card ──────────────────────────────── */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 select-none">
                <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setNoteOpen((v) => !v)}>
                  <StickyNote size={15} className="text-amber-500" />
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Note — Paste your mails here</span>
                  {total > 0 && <span className="text-[11px] bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 rounded-full">{total} mails</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {doneCount > 0 && <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSaveNote(); }}
                    disabled={!hasUnsaved && cards.length > 0}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all shadow-sm ${
                      hasUnsaved
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-default"
                    }`}
                  >
                    <Check size={11} strokeWidth={3} />
                    {hasUnsaved ? "Save" : "Saved"}
                  </button>
                  {note && (
                    confirmClear ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-red-500 font-medium">Clear note only?</span>
                        <button onClick={clearNote} className="px-2 py-0.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg">Yes</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmClear(false); }} className="px-2 py-0.5 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">No</button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmClear(true); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors">
                        <Trash2 size={11} /> Clear Note
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
                    className="w-full h-80 text-sm font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 dark:focus:ring-amber-800 transition-all" />
                  {dupWarning > 0 && <span className="text-[11px] text-orange-500 font-semibold animate-pulse mt-1">{dupWarning} duplicate{dupWarning > 1 ? "s" : ""} skipped</span>}
                </div>
              )}
            </div>

            {/* ── Info card ──────────────────────────────── */}
            {total > 0 && (() => {
              const scheduledCount = cards.filter(c => !!dueDates[c.id]).length;
              const overdueCount   = cards.filter(c => { const iso = dueDates[c.id]; return iso ? daysLeftFromISO(iso) <= 0 : false; }).length;
              const remaining      = total - doneCount;
              const pct            = total > 0 ? Math.round((doneCount / total) * 100) : 0;
              return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-2 flex items-center gap-4">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Overview</span>
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300"><span className="font-extrabold text-sm">{total}</span> Total</span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><span className="font-extrabold text-sm">{doneCount}</span> Done</span>
                    <span className="text-[11px] font-semibold text-blue-500 dark:text-blue-400"><span className="font-extrabold text-sm">{remaining}</span> Left</span>
                    <span className={`text-[11px] font-semibold ${overdueCount > 0 ? "text-red-500 dark:text-red-400" : "text-orange-500 dark:text-orange-400"}`}>
                      <span className="font-extrabold text-sm">{overdueCount > 0 ? overdueCount : scheduledCount}</span> {overdueCount > 0 ? "Overdue" : "Sched."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{pct}%</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })()}

            {/* ── Groups ─────────────────────────────────── */}
            {groups.map((group, gi) => {
              const startNum  = gi * GROUP_SIZE + 1;
              const endNum    = startNum + group.length - 1;
              const collapsed = collapsedGroups.has(gi);
              const groupDone = group.filter((c) => doneIds.has(c.id)).length;
              const allDone   = groupDone === group.length;

              return (
                <div key={gi} className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${allDone ? "border-emerald-200 dark:border-emerald-800" : "border-slate-200 dark:border-slate-700"}`}>
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

                  {!collapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
                      {group.map((card, localIdx) => {
                        const globalIdx = gi * GROUP_SIZE + localIdx;
                        const done      = doneIds.has(card.id);
                        const isoVal    = dueDates[card.id] ?? "";
                        const inactive  = isoVal.length > 0;
                        // Compute real days remaining from the stored ISO date
                        const daysLeft  = isoVal ? daysLeftFromISO(isoVal) : null;
                        const dueLabel  = isoVal ? formatISO(isoVal) : null;

                        const isCopied = copiedIds.has(card.id);
                        return (
                          <div key={card.id}
                            onDoubleClick={() => isCopied ? unmarkCopied(card.id) : undefined}
                            title={isCopied ? "Double-click to reset" : undefined}
                            className={`rounded-xl border flex flex-col gap-0 transition-all shadow-sm overflow-hidden ${
                              inactive
                                ? "bg-gray-950 border-gray-800"
                                : isCopied
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/50"
                                  : done
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow"
                            }`}
                          >
                            {inactive && (
                              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-white/40 font-mono">INACTIVE</span>
                                  {dueLabel && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      daysLeft !== null && daysLeft <= 0
                                        ? "text-red-400 bg-red-400/15"
                                        : "text-orange-400 bg-orange-400/15"
                                    }`}>
                                      📅 {dueLabel}
                                      {daysLeft !== null && (
                                        <span className="ml-1 opacity-80">
                                          ({daysLeft <= 0 ? "OVER" : `${daysLeft}d`})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <button onClick={() => activateCard(card.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors">
                                  <Zap size={9} strokeWidth={2.5} /> Active
                                </button>
                              </div>
                            )}

                            <div className="p-3.5 flex flex-col gap-2.5 flex-1">
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

                              <p className={`text-xs font-mono break-all leading-relaxed flex-1 ${
                                inactive ? "text-white/80" : done ? "text-emerald-700 dark:text-emerald-400 line-through opacity-60" : "text-slate-800 dark:text-slate-200"
                              }`}>
                                {card.text}
                              </p>

                              <div className={`flex items-center gap-1.5 pt-2 border-t ${inactive ? "border-white/10" : "border-slate-100 dark:border-slate-700"}`}>
                                <CopyBtn text={card.text} dark={inactive} onCopy={!inactive ? () => markCopied(card.id) : undefined} />
                                <DaysInput
                                  value={isoVal}
                                  onChange={(iso) => setDueDate(card.id, iso)}
                                  inactive={inactive}
                                  dark={inactive}
                                />
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
    </div>
  );
}
