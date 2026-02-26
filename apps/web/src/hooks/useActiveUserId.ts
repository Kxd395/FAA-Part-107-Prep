"use client";

import { useContext } from "react";
import { AuthContext } from "../components/AuthProvider";
import { LOCAL_USER_ID } from "../lib/analyticsTaxonomy";

export function useActiveUserId(): string {
  const auth = useContext(AuthContext);
  return auth?.user?.userId ?? LOCAL_USER_ID;
}
