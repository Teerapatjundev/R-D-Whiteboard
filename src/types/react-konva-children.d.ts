import type * as React from "react";

declare module "react-konva" {
  interface StageProps {
    children?: React.ReactNode;
  }
}
