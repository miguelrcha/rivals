"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/format";

export function ActiveRunElapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <>{formatElapsed(now - new Date(startedAt).getTime())}</>;
}
