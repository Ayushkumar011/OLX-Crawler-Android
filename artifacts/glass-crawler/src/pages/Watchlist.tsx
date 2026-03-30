import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  useGetWatchlist, 
  useGetRecentWatchlist,
  useRemoveFromWatchlist,
  useDeleteFromRecentWatchlist,
  getGetWatchlistQueryKey,
  getGetRecentWatchlistQueryKey,
  type WatchlistItem 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, ExternalLink, ArchiveX, MapPin, EyeOff } from "lucide-react";
import { GlassCard, GradientText } from "@/components/ui/glass-components";
import { ListingDetailModal } from "@/components/ListingDetailModal";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Watchlist() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"active" | "recent">("active");
  const [selectedListing, setSelectedListing] = useState<WatchlistItem | null>(null);

  const { data: watchlistedItems, isLoading: isWatchlistLoading } = useGetWatchlist();
  const { data: recentItems, isLoading: isRecentLoading } = useGetRecentWatchlist();
  
  const removeMutation = useRemoveFromWatchlist();
  const deleteMutation = useDeleteFromRecentWatchlist();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRemove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await removeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentWatchlistQueryKey() });
      toast({ title: "Moved to recent watchlist" });
    } catch (err) {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this item?")) return;
    
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetRecentWatchlistQueryKey() });
      toast({ title: "Item permanently deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const currentItems = activeTab === "active" ? watchlistedItems : recentItems;
  const isLoading = activeTab === "active" ? isWatchlistLoading : isRecentLoading;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen relative w-full pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="fixed inset-0 z-[-1] bg-background">
        <img 
          src={`${import.meta.env.BASE_URL}images/glass-bg.png`}
          alt="Liquid Glass Background"
          className="w-full h-full object-cover opacity-60 mix-blend-screen blur-sm"
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div className="flex items-center">
            <button 
              onClick={() => setLocation('/')}
              className="mr-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">
                <GradientText>My Watchlist</GradientText>
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Keep track of items across different crawls
              </p>
            </div>
          </div>

          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "active" 
                  ? "bg-white/20 text-white shadow-sm" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              Active ({watchlistedItems?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("recent")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "recent" 
                  ? "bg-white/20 text-white shadow-sm" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              Recent ({recentItems?.length || 0})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-32">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : !currentItems || currentItems.length === 0 ? (
          <GlassCard className="py-24 text-center border-dashed border-white/20">
            {activeTab === "active" ? (
              <EyeOff className="w-12 h-12 text-white/20 mx-auto mb-4" />
            ) : (
              <ArchiveX className="w-12 h-12 text-white/20 mx-auto mb-4" />
            )}
            <h3 className="text-xl text-white font-medium mb-2">No {activeTab} items found</h3>
            <p className="text-white/50">
              {activeTab === "active" 
                ? "Add items from the search results to keep track of them." 
                : "Items you remove from your active watchlist will appear here."}
            </p>
          </GlassCard>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {currentItems.map((listing: WatchlistItem) => (
              <motion.div variants={itemVariants} key={listing.id}>
                <GlassCard 
                  className="p-0 overflow-hidden group h-full flex flex-col glass-panel-hover cursor-pointer"
                  onClick={() => setSelectedListing(listing)}
                >
                  <div className="h-48 w-full bg-black/50 relative overflow-hidden">
                    {listing.imageUrl ? (
                      <img 
                        src={listing.imageUrl} 
                        alt={listing.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
                        <span className="text-white/30 text-sm uppercase tracking-widest font-bold">No Image</span>
                      </div>
                    )}
                    
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-primary font-bold shadow-lg">
                      {formatPrice(listing.price)}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-white font-bold text-lg leading-snug mb-3 line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                      {listing.title}
                    </h3>
                    
                    <div className="flex items-center text-white/50 text-sm mt-auto pb-4">
                      <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{listing.location || 'Unknown location'}</span>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-between items-center mt-auto">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(listing.listingUrl, '_blank');
                        }}
                        className="text-xs font-bold uppercase tracking-wider text-secondary hover:text-white transition-colors flex items-center"
                      >
                        Source <ExternalLink className="w-3 h-3 ml-1" />
                      </button>
                      
                      {activeTab === "active" ? (
                        <button 
                          onClick={(e) => handleRemove(e, listing.id)}
                          className="text-white/30 hover:text-orange-400 transition-colors p-1.5 rounded-md hover:bg-white/5"
                          title="Remove from watchlist"
                        >
                          <ArchiveX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => handleDelete(e, listing.id)}
                          className="text-white/30 hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                          title="Permanently delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <ListingDetailModal 
        listing={selectedListing} 
        onClose={() => setSelectedListing(null)} 
      />
    </div>
  );
}
