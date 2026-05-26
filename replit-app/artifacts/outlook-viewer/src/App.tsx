import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Link, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import AllMail from "@/pages/AllMail";
import { Mail, LayoutGrid, Sun, Moon } from "lucide-react";

const queryClient = new QueryClient();

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((v) => !v) };
}

function TabBar({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const [isHome] = useRoute("/");
  const [isAllMail] = useRoute("/all-mail");

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-1 h-12 shrink-0 select-none">
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Mail size={14} className="text-white" />
        </div>
        <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Outlook</span>
      </div>

      <Link
        href="/"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          isHome
            ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <Mail size={13} />
        Outlook
      </Link>

      <Link
        href="/all-mail"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          isAllMail
            ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <LayoutGrid size={13} />
        All Mail
      </Link>

      <button
        onClick={onToggle}
        title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-xs font-medium"
      >
        {dark ? <Sun size={14} /> : <Moon size={14} />}
        {dark ? "Day" : "Night"}
      </button>
    </header>
  );
}

function Router({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <TabBar dark={dark} onToggle={onToggle} />
      <div className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/all-mail" component={AllMail} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  const { dark, toggle } = useDarkMode();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router dark={dark} onToggle={toggle} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
