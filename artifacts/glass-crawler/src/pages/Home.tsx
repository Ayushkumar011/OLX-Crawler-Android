import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search, MapPin, Tag, Activity, History, ArrowRight, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  GlassCard, 
  NeonButton, 
  GlassInput, 
  GradientText 
} from "@/components/ui/glass-components";
import { CrawlProgressModal } from "@/components/CrawlProgressModal";
import { useCrawlManager } from "@/hooks/use-crawler";
import { useGetSessions, useDeleteSession, getGetSessionsQueryKey, CrawlSessionStatus } from "@workspace/api-client-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { startCrawl, isStarting } = useCrawlManager();
  const { data: sessions, isLoading: loadingSessions } = useGetSessions();
  const queryClient = useQueryClient();
  const deleteSessionMutation = useDeleteSession();
  
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Form State
  const [location, setCrawlLocation] = useState("");
  const [productName, setProductName] = useState("");
  const [negativeKeywords, setNegativeKeywords] = useState("");

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await deleteSessionMutation.mutateAsync({ sessionId });
      queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
    } catch (err) {
      console.error("Failed to delete session", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location || !productName) return;

    try {
      const result = await startCrawl({
        location,
        productName,
        negativeKeywords: negativeKeywords || null,
      });
      if (result?.id) {
        setActiveSessionId(result.id);
      }
    } catch (err) {
      console.error("Failed to start crawl", err);
    }
  };

  return (
    <div className="min-h-screen relative w-full pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      
      {/* Background Image Setup */}
      <div className="fixed inset-0 z-[-1] bg-background">
        <img 
          src={`${import.meta.env.BASE_URL}images/glass-bg.png`}
          alt="Liquid Glass Background"
          className="w-full h-full object-cover opacity-80 mix-blend-screen"
        />
        {/* Dark vignette overlay to ensure text readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center p-2 mb-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <Activity className="w-5 h-5 text-primary mr-2" />
            <span className="text-sm font-medium text-white/80 tracking-wide uppercase">OLX Extraction Engine</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold text-white mb-6 tracking-tight">
            Discover with <GradientText>GlassCrawler</GradientText>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Deploy intelligent agents to scrape, filter, and extract pristine listing data from OLX.in in real-time.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Form Column */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-7"
          >
            <GlassCard>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Search className="w-6 h-6 mr-3 text-secondary" />
                New Crawl Mission
              </h2>
              
              <form onSubmit={handleStartCrawl} className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between mb-2 ml-1">
                    <label className="text-sm font-medium text-white/70">Location Filter</label>
                    <span className="text-xs text-white/35">filters by city or state</span>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <GlassInput 
                      required
                      className="pl-12"
                      placeholder="e.g. Mumbai, Delhi, Karnataka" 
                      value={location}
                      onChange={(e) => setCrawlLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Product Query</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <GlassInput 
                      required
                      className="pl-12"
                      placeholder="e.g. iPhone 14, Royal Enfield, Samsung TV" 
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Negative Keywords (Optional)</label>
                  <GlassInput 
                    placeholder="Comma separated: broken, parts, damaged" 
                    value={negativeKeywords}
                    onChange={(e) => setNegativeKeywords(e.target.value)}
                  />
                  <p className="text-xs text-white/40 mt-2 ml-1">Listings containing these words will be automatically discarded.</p>
                </div>

                <div className="pt-4">
                  <NeonButton 
                    type="submit" 
                    className="w-full flex justify-center items-center text-lg py-4"
                    disabled={isStarting || !location || !productName}
                  >
                    {isStarting ? "Initializing..." : "Launch Crawler"}
                  </NeonButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>

          {/* History Column */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-5"
          >
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-xl font-display font-bold text-white flex items-center">
                <History className="w-5 h-5 mr-2 text-primary" />
                Recent Missions
              </h3>
            </div>

            <div className="space-y-4">
              {loadingSessions ? (
                <div className="flex justify-center p-8">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                </div>
              ) : !sessions || sessions.length === 0 ? (
                <GlassCard className="p-8 text-center text-white/50 border-dashed border-white/20">
                  No previous crawl missions found.
                </GlassCard>
              ) : (
                <AnimatePresence mode="popLayout">
                  {sessions.slice(0, 5).map((session, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40, scale: 0.95 }}
                      transition={{ delay: 0.5 + (idx * 0.1), exit: { duration: 0.25, delay: 0 } }}
                      key={session.id}
                      layout
                    >
                      <GlassCard 
                        className="p-5 glass-panel-hover cursor-pointer group relative"
                        onClick={() => setLocation(`/results?sessionId=${session.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-white truncate pr-2">{session.productName}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                              ${session.status === CrawlSessionStatus.completed ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                                session.status === CrawlSessionStatus.failed ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'}
                            `}>
                              {session.status}
                            </div>
                            <button
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              disabled={deletingId === session.id}
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/20 text-white/40 hover:text-red-400 disabled:opacity-50"
                              title="Delete session"
                            >
                              {deletingId === session.id ? (
                                <div className="w-3.5 h-3.5 rounded-full border border-red-400 border-t-transparent animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-white/50 mb-3">
                          <MapPin className="w-3.5 h-3.5 mr-1" /> {session.location}
                          <span className="mx-2">•</span>
                          <span>{format(new Date(session.createdAt), 'MMM d, HH:mm')}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                          <div className="text-xs text-white/60">
                            <strong className="text-white">{session.itemsFound}</strong> items extracted
                          </div>
                          <ArrowRight className="w-4 h-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            
            {sessions && sessions.length > 5 && (
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setLocation('/results')}
                  className="text-sm text-primary hover:text-white transition-colors"
                >
                  View All Data →
                </button>
              </div>
            )}
            
          </motion.div>
        </div>
      </div>

      <CrawlProgressModal 
        sessionId={activeSessionId} 
        onClose={() => setActiveSessionId(null)} 
      />
    </div>
  );
}
