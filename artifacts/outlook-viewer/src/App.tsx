import { Switch, Route, Router as WouterRouter, Link, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import AllMail from "@/pages/AllMail";
import { Mail, LayoutGrid } from "lucide-react";

const queryClient = new QueryClient();

function TabBar() {
  const [isHome] = useRoute("/");
  const [isAllMail] = useRoute("/all-mail");

  return (
    <header className="bg-white border-b border-slate-200 flex items-center px-4 gap-1 h-12 shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Mail size={14} className="text-white" />
        </div>
        <span className="text-sm font-extrabold text-slate-900 tracking-tight">Outlook</span>
      </div>

      {/* Tabs */}
      <Link
        href="/"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isHome ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
      >
        <Mail size={13} />
        Outlook
      </Link>

      <Link
        href="/all-mail"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isAllMail ? "bg-blue-50 text-blue-700 border border-blue-200" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
      >
        <LayoutGrid size={13} />
        All Mail
      </Link>
    </header>
  );
}

function Router() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <TabBar />
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
