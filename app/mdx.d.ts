interface Frontmatter {
  title: string;
  description?: string;
}

declare module "*.mdx" {
  import { MDXProps } from "mdx/types";
  import { ComponentType } from "react";

  export const frontmatter: Frontmatter;
  const MDXComponent: ComponentType<MDXProps>;
  export default MDXComponent;
}

declare module "*.md" {
  import { MDXProps } from "mdx/types";
  import { ComponentType } from "react";

  export const frontmatter: Frontmatter;
  const MDXComponent: ComponentType<MDXProps>;
  export default MDXComponent;
}
