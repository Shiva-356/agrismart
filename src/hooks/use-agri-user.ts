import { useEffect, useState } from "react";
import { loadUser } from "@/lib/agri";

export function useAgriUser() {
  const [user, setUserState] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const sync = () => setUserState(loadUser());
    sync();
    window.addEventListener("agrismart:auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("agrismart:auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return user;
}
