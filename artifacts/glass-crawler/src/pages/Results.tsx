import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetListings, 
  useDeleteListing, 
  useAddToWatchlist,
  getGetListingsQueryKey,
  type Listing 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, ArrowLeft, Trash2, ExternalLink, Filter, BookmarkPlus, Clock } from "lucide-react";
import { GlassCard, GlassInput, GradientText } from "@/components/ui/glass-components";
import { ListingDetailModal } from "@/components/ListingDetailModal";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Results() {
  const [location, setLocation] = useLocation();
  const queryParams = new URLSearchParams(window.location.search);
  const sessionIdParam = queryParams.get('sessionId');
  const sessionId = sessionIdParam ? parseInt(sessionIdParam, 10) : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const { data: listings, isLoading } = useGetListings({ 
    sessionId: sessionId || undefined 
  });
  
  const deleteMutation = useDeleteListing();
  const addToWatchlistMutation = useAddToWatchlist();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    if (!searchQuery) return listings;
    const lowerQuery = searchQuery.toLowerCase();
    return listings.filter(l => 
      l.title.toLowerCase().includes(lowerQuery) || 
      (l.description && l.description.toLowerCase().includes(lowerQuery)) ||
      (l.location && l.location.toLowerCase().includes(lowerQuery))
    );
  }, [listings, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent opening the modal
    if (!confirm("Are you sure you want to delete this listing?")) return;
    
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
      toast({ title: "Listing deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleAddToWatchlist = async (e: React.MouseEvent, listing: Listing) => {
    e.stopPropagation();
    try {
      await addToWatchlistMutation.mutateAsync({
        data: {
          olxId: listing.olxId,
          title: listing.title,
          price: listing.price,
          imageUrl: listing.imageUrl,
          listingUrl: listing.listingUrl,
          description: listing.description,
          sellerName: listing.sellerName,
          sellerJoinDate: listing.sellerJoinDate,
          location: listing.location,
        }
      });
      toast({ title: "Added to Watchlist" });
    } catch (err) {
      toast({ title: "Failed to add to watchlist", variant: "destructive" });
    }
  };

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
      {/* Background Image Setup */}
      <div className="fixed inset-0 z-[-1] bg-background">
        <img 
          src={`${import.meta.env.BASE_URL}images/glass-bg.png`}
          alt="Liquid Glass Background"
          className="w-full h-full object-cover opacity-60 mix-blend-screen blur-sm"
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* Header Controls */}
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
                <GradientText>Extracted Data</GradientText>
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {sessionId ? `Session #${sessionId}` : 'All historic crawls'} • {filteredListings.length} items
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <GlassInput 
              placeholder="Filter results..." 
              className="pl-12 bg-black/40 border-white/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-32">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : filteredListings.length === 0 ? (
          <GlassCard className="py-24 text-center border-dashed border-white/20">
            <Filter className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl text-white font-medium mb-2">No listings found</h3>
            <p className="text-white/50">Try adjusting your filters or running a new crawl mission.</p>
          </GlassCard>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredListings.map((listing) => (
              <motion.div variants={itemVariants} key={listing.id}>
                <GlassCard 
                  className="p-0 overflow-hidden cursor-pointer group h-full flex flex-col glass-panel-hover"
                  onClick={() => setSelectedListing(listing)}
                >
                  {/* Image Header */}
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
                    
                    {/* Floating price badge */}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-primary font-bold shadow-lg">
                      {formatPrice(listing.price)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-white font-bold text-lg leading-snug mb-3 line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                      {listing.title}
                    </h3>
                    
                    <div className="flex items-center text-white/50 text-sm mt-auto pb-1">
                      <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{listing.location || 'Unknown location'}</span>
                    </div>

                    {listing.listingDate && (
                      <div className="flex items-center text-white/35 text-xs pb-4">
                        <Clock className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span>{listing.listingDate}</span>
                      </div>
                    )}

                    {/* Actions Border */}
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
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => handleAddToWatchlist(e, listing)}
                          className="text-white/30 hover:text-primary transition-colors p-1.5 rounded-md hover:bg-white/5"
                          title="Add to watchlist"
                        >
                          <BookmarkPlus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, listing.id)}
                          className="text-white/30 hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                          title="Delete listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
