import type { PropsWithChildren } from "react";
import type { MDXComponents } from "mdx/types";

import { Callout } from "./components/Callouts";

const components: MDXComponents = {};

function capitalize(s: string): string {
  if (s.length > 0) {
    return s[0].toLocaleUpperCase() + s.slice(1).toLocaleLowerCase();
  } else {
    return s;
  }
}

type MaybeCalloutProps = {
  "data-callout"?: boolean;
  "data-callout-type"?: "note" | "warning";
  "data-callout-title"?: string;
  "data-callout-body"?: string;
};

export function useMDXComponents(): MDXComponents {
  return {
    ...components,
    div: ({ children, ...props }: PropsWithChildren & MaybeCalloutProps) => {
      if (props["data-callout-title"]) {
        return null;
      }
      if (props["data-callout-body"]) {
        return children;
      }
      if (props["data-callout"]) {
        return (
          <Callout
            type={props["data-callout-type"] ?? "note"}
            title={capitalize(props["data-callout-type"] ?? "")}
          >
            {children}
          </Callout>
        );
      } else {
        return <div {...props}>{children}</div>;
      }
    },
  };
}
