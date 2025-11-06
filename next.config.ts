import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactCompiler: true,
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      "remark-frontmatter",
      "remark-mdx-frontmatter",
      "remark-gfm",
      "@r4ai/remark-callout",
      "remark-prism",
      "remark-math",
    ],
    rehypePlugins: ["rehype-slug", "rehype-autolink-headings", "rehype-katex"],
  },
});

export default withMDX(nextConfig);
