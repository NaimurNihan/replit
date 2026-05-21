import { useState, useMemo, useEffect, useRef } from "react";
import { Copy, Check, StickyNote, Trash2, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";

const LS_NOTE  = "allmail_note_v1";
const LS_DONE  = "allmail_done_v1";
const LS_DATES = "allmail_dates_v1";

interface MailCard {
  id: string;
  text: string;
  index: number;
}

function parseMails(raw: string): MailCard[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text, i) => ({ id: `mail-${i}-${text.slice(0, 8)}`, text, index: i }));
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

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function DateBox({
  value,
  onChange,
  done,
}: {
  value: string;   // "MM-DD"
  onChange: (v: string) => void;
  done: boolean;
}) {
  const [month, day] = value ? value.split("-") : ["", ""];

  const setMonth = (m: string) => onChange(m && day ? `${m}-${day}` : m ? `${m}-` : "");
  const setDay   = (d: string) => {
    const num = d.replace(/\D/g, "").slice(0, 2);
    const clamped = num && parseInt(num) > 31 ? "31" : num;
    onChange(month ? `${month}-${clamped}` : `-${clamped}`);
  };

  const displayMonth = month ? MONTHS[parseInt(month) - 1] ?? "" : "";
  const displayDay   = day ? (day === "-" ? "" : day.replace("-","")) : "";

  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium transition-all ${
      value && value !== "-"
        ? done
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-400"
    }`}>
      <CalendarDays size={10} className="shrink-0 opacity-60" />

      {/* Month select */}
      <select
        value={month || ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setMonth(e.target.value)}
        className="bg-transparent outline-none cursor-pointer text-[11px] font-medium max-w-[34px]"
        title="Month"
      >
        <option value="">MM</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
        ))}
      </select>

      <span className="opacity-40">/</span>

      {/* Day input */}
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="DD"
        value={displayDay}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDay(e.target.value)}
        className="bg-transparent outline-none w-[18px] text-center text-[11px] font-mono placeholder:text-slate-300"
        title="Day"
      />
    </div>
  );
}

export default function AllMail() {
  const [note, setNote] = useState<string>(() => localStorage.getItem(LS_NOTE) ?? "");
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_DONE) ?? "[]")); }
    catch { return new Set(); }
  });
  const [dates, setDates] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_DATES) ?? "{}"); }
    catch { return {}; }
  });
  const [noteOpen, setNoteOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { localStorage.setItem(LS_NOTE,  note); }, [note]);
  useEffect(() => { localStorage.setItem(LS_DONE,  JSON.stringify([...doneIds])); }, [doneIds]);
  useEffect(() => { localStorage.setItem(LS_DATES, JSON.stringify(dates)); }, [dates]);

  const cards     = useMemo(() => parseMails(note), [note]);
  const doneCount = doneIds.size;
  const total     = cards.length;

  const toggleDone = (id: string) =>
    setDoneIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setDate = (id: string, val: string) =>
    setDates((prev) => ({ ...prev, [id]: val }));

  const clearAll = () => {
    if (!confirm("Clear all mails and marks?")) return;
    setNote(""); setDoneIds(new Set()); setDates({});
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* Note Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none" onClick={() => setNoteOpen((v) => !v)}>
            <div className="flex items-center gap-2">
              <StickyNote size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-800">Note — Paste your mails here</span>
              {total > 0 && <span className="text-[11px] bg-amber-200 text-amber-700 font-semibold px-2 py-0.5 rounded-full">{total} mails</span>}
            </div>
            <div className="flex items-center gap-2">
              {doneCount > 0 && <span className="text-[11px] bg-emerald-100 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">✓ {doneCount} done</span>}
              {noteOpen ? <ChevronUp size={14} className="text-amber-400" /> : <ChevronDown size={14} className="text-amber-400" />}
            </div>
          </div>

          {noteOpen && (
            <div className="px-4 pb-4">
              <textarea
                ref={textareaRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={"Paste all your emails here — one per line, or separated by commas.\nExample:\nexample1@outlook.com\nexample2@gmail.com\n..."}
                className="w-full h-36 text-sm font-mono text-slate-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-all"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-amber-500">Each line = 1 mail card below</p>
                {note && (
                  <button onClick={clearAll} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={11} /> Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {total > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400 font-medium">
              {total} mail{total !== 1 ? "s" : ""}
              {doneCount > 0 && <span className="ml-2 text-emerald-500 font-semibold">· {doneCount} done · {total - doneCount} remaining</span>}
            </p>
            {doneCount > 0 && (
              <div className="flex-1 mx-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Mail Cards Grid */}
        {total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => {
              const done      = doneIds.has(card.id);
              const dateVal   = dates[card.id] ?? "";
              return (
                <div
                  key={card.id}
                  className={`relative rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all shadow-sm ${
                    done ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow"
                  }`}
                >
                  {/* Number + DONE badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      {String(card.index + 1).padStart(3, "0")}
                    </span>
                    {done && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full leading-none">DONE</span>}
                  </div>

                  {/* Mail text */}
                  <p className={`text-xs font-mono break-all leading-relaxed flex-1 ${done ? "text-emerald-700 line-through opacity-60" : "text-slate-800"}`}>
                    {card.text}
                  </p>

                  {/* Actions row: Copy | Date | Mark Done */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <CopyBtn text={card.text} />

                    {/* Date Box */}
                    <DateBox
                      value={dateVal}
                      onChange={(v) => setDate(card.id, v)}
                      done={done}
                    />

                    <button
                      onClick={() => toggleDone(card.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ml-auto ${
                        done
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600"
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

        {/* Empty state */}
        {total === 0 && (
          <div className="text-center py-20 text-slate-300">
            <StickyNote size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-slate-400">Paste your mails in the note card above</p>
            <p className="text-xs text-slate-300 mt-1">Each line will become a card</p>
          </div>
        )}
      </div>
    </div>
  );
}
