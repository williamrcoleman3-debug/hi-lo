import { useEffect, useState } from "react";
import { fetchSiteMessages } from "../siteMessages/siteMessages.js";

// Fetched once per session (not polled/subscribed — an editor change is
// expected to be picked up on the visitor's next load, not pushed live).
export function useSiteMessages() {
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteMessages().then((data) => {
      if (!cancelled) {
        setMessages(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { messages, loading };
}
