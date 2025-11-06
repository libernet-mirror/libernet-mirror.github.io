import { type PropsWithChildren } from "react";

import { DocsHeader } from "@/components/DocsHeader";
import { PrevNextLinks } from "@/components/PrevNextLinks";
import { Prose } from "@/components/Prose";

export const Article = ({
  title,
  children,
}: PropsWithChildren & { title: string }) => (
  <>
    <div className="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
      <article>
        <DocsHeader title={title} />
        <Prose>{children}</Prose>
      </article>
      <PrevNextLinks />
    </div>
    {/* TODO: table of contents. */}
    {/* <TableOfContents tableOfContents={tableOfContents} /> */}
  </>
);
