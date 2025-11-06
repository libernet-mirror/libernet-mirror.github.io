import { type PropsWithChildren } from "react";

import { Article } from "@/components/Article";

import { frontmatter } from "./page.md";

export default function Page({ children }: PropsWithChildren) {
  return <Article title={frontmatter.title}>{children}</Article>;
}
