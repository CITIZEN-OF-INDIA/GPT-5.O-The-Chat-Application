import type { Message } from "../../../packages/shared-types/message";

export type DebugSource =
  | "optimistic"
  | "socket"
  | "sync"
  | "db";

export type DebugMessage = Message & {
  __source?: DebugSource;
};
