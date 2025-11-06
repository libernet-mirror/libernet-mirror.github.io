import { type PropsWithChildren } from "react";

import { Article } from "@/components/Article";

export default function Page({ children }: PropsWithChildren) {
  return <Article title="Wallet Format V1">{children}</Article>;
}
