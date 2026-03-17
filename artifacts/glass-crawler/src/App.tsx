import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Results from "@/pages/Results";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="fixed inset-0 z-[-1] bg-background">
        <img 
          src={`${import.meta.env.BASE_URL}images/glass-bg.png`}
          alt="Liquid Glass Background"
          className="w-full h-full object-cover opacity-50 mix-blend-screen blur-md"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>
      <div className="glass-panel p-12 rounded-3xl text-center max-w-md">
        <h1 className="text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-4">404</h1>
        <p className="text-xl text-white/80 mb-8">Signal lost. The data you're looking for doesn't exist.</p>
        <a href="/" className="inline-block bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all">
          Return to Base
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/results" component={Results} />
      <Route component={NotFound} />
    </Switch>
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
