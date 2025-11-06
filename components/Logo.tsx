import Image from "next/image";

import logo from "./logo.svg";

export const Logo = ({ className }: { className: string }) => (
  <Image
    src={logo}
    alt="Libernet"
    width="36"
    height="36"
    className={className}
  />
);
