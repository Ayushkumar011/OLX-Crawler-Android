import { motion, AnimatePresence } from "framer-motion";
import { useActiveCrawlSession } from "@/hooks/use-crawler";
import { Loader2, CheckCircle2, AlertCircle, Search, Layers, ShieldX } from "lucide-react";
import { CrawlSessionStatus } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface CrawlProgressModalProps {
  sessionId: number | null;
  onClose: () => void;
}

export function CrawlProgressModal({ sessionId, onClose }: CrawlProgressModalProps) {
  const { session } = useActiveCrawlSession(sessionId);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // FIX: Early return with explicit undefined satisfies TypeScript
    if (session?.status !== CrawlSessionStatus.completed) {
      return undefined;
    }

    // Small delay so user sees "completed" state before jumping
    const timer = setTimeout(() => {
      setLocation(`/results?sessionId=${session.id}`);
      onClose();
    }, 1500);

    return () => clearTimeout(timer);
  }, [session?.status, session?.id, setLocation, onClose]);

  if (!sessionId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-md"
        >
          <div className="glass-panel rounded-3xl p-8 border border-white/20 shadow-[0_0_50px_rgba(0,255,255,0.1)] relative overflow-hidden">

            {/* Animated background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center">

              <div className="mb-6 relative">
                {session?.status === CrawlSessionStatus.running || session?.status === CrawlSessionStatus.pending ? (
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <div className="absolute inset-0 border-4 border-t-secondary border-r-transparent border-b-primary border-l-transparent rounded-full animate-[spin_3s_linear_infinite]" />
                  </div>
                ) : session?.status === CrawlSessionStatus.completed ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-400">
                    <CheckCircle2 className="w-16 h-16" />
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-destructive">
                    <AlertCircle className="w-16 h-16" />
                  </motion.div>
                )}
              </div>

              <h2 className="text-2xl font-display font-bold text-white mb-2">
                {session?.status === CrawlSessionStatus.pending && "Initializing Crawl..."}
                {session?.status === CrawlSessionStatus.running && "Extracting Data..."}
                {session?.status === CrawlSessionStatus.completed && "Crawl Complete!"}
                {session?.status === CrawlSessionStatus.failed && "Crawl Failed"}
              </h2>

              <p className="text-muted-foreground mb-8">
                Target: <span className="text-white font-medium">{session?.productName}</span> in {session?.location}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 w-full mb-6">
                <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
                  <Layers className="w-5 h-5 text-primary mb-2 opacity-80" />
                  <span className="text-2xl font-bold text-white">{session?.pagesLoaded || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Pages</span>
                </div>

                <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
                  <Search className="w-5 h-5 text-secondary mb-2 opacity-80" />
                  <span className="text-2xl font-bold text-white">{session?.itemsFound || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Found</span>
                </div>

                <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
                  <ShieldX className="w-5 h-5 text-accent mb-2 opacity-80" />
                  <span className="text-2xl font-bold text-white">{session?.itemsFiltered || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Filtered</span>
                </div>
              </div>

              {session?.errorMessage && (
                <div className="w-full bg-destructive/20 border border-destructive/50 text-destructive-foreground p-3 rounded-lg text-sm mb-6">
                  {session.errorMessage}
                </div>
              )}

              {(session?.status === CrawlSessionStatus.completed || session?.status === CrawlSessionStatus.failed) && (
                <button
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  Close
                </button>
              )}

            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}