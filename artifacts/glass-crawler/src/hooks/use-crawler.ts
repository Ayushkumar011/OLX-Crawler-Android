import { useState, useEffect } from "react";
import {
  useGetCrawlStatus,
  useStartCrawl,
  getGetSessionsQueryKey,
  CrawlSessionStatus,
  type CrawlRequest
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Wrapper for starting a crawl with cache invalidation and toast
export function useCrawlManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startMutation = useStartCrawl({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
        toast({
          title: "Crawl Started",
          description: "Initiating glass-crawler sequence...",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Failed to start crawl",
          description: error?.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    }
  });

  const startCrawl = async (data: CrawlRequest) => {
    return startMutation.mutateAsync({ data });
  };

  return {
    startCrawl,
    isStarting: startMutation.isPending,
  };
}

// Polling hook for active session
export function useActiveCrawlSession(sessionId: number | null) {
  const { data: session, isLoading, error } = useGetCrawlStatus(
    sessionId as number,
    {
      query: {
        // 👉 THE FIX: Added the mandatory queryKey property
        queryKey: ['crawlSession', sessionId as number],
        enabled: !!sessionId,
        // Poll every 2 seconds if running or pending
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === CrawlSessionStatus.running || status === CrawlSessionStatus.pending) {
            return 2000;
          }
          return false;
        }
      }
    }
  );

  return { session, isLoading, error };
}