import { motion, AnimatePresence } from "framer-motion";
import { type Listing } from "@workspace/api-client-react";
import { X, ExternalLink, MapPin, Calendar, User, Tag } from "lucide-react";
import { NeonButton } from "./ui/glass-components";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
}

export function ListingDetailModal({ listing, onClose }: ListingDetailModalProps) {
  if (!listing) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 30 }}
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden glass-panel rounded-3xl flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-white/10 relative z-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white pr-8 leading-tight">
                {listing.title}
              </h2>
              <div className="text-primary font-bold text-xl mt-2">
                {formatPrice(listing.price)}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="absolute right-6 top-6 p-2 rounded-full bg-white/5 hover:bg-white/20 text-white transition-colors border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content scrollable area */}
          <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Image Column */}
              <div className="space-y-4">
                <div className="aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10 relative group">
                  {listing.imageUrl ? (
                    <img 
                      src={listing.imageUrl} 
                      alt={listing.title}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center flex-col text-muted-foreground">
                      <Tag className="w-12 h-12 mb-2 opacity-50" />
                      <span>No Image Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details Column */}
              <div className="space-y-6 text-white/90">
                
                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center text-primary mb-1">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-xs font-bold uppercase tracking-wider">Location</span>
                    </div>
                    <div className="font-medium text-white">{listing.location || 'Unknown'}</div>
                  </div>
                  
                  <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center text-secondary mb-1">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span className="text-xs font-bold uppercase tracking-wider">Found</span>
                    </div>
                    <div className="font-medium text-white text-sm">
                      {format(new Date(listing.createdAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded-xl border border-white/5 col-span-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center text-accent mb-1">
                        <User className="w-4 h-4 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-wider">Seller Info</span>
                      </div>
                      <div className="font-medium text-white">{listing.sellerName || 'Anonymous'}</div>
                    </div>
                    {listing.sellerJoinDate && (
                      <div className="text-right text-xs text-muted-foreground">
                        Joined<br/>{listing.sellerJoinDate}
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-white/10 pb-2">Description</h3>
                  <div className="bg-black/20 p-5 rounded-xl border border-white/5 text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar text-white/80">
                    {listing.description || <span className="italic text-muted-foreground">No description provided by the seller.</span>}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end">
            <NeonButton 
              onClick={() => window.open(listing.listingUrl, '_blank')}
              className="flex items-center"
            >
              View on OLX.in <ExternalLink className="w-4 h-4 ml-2" />
            </NeonButton>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
